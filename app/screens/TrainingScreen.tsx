// Training-Hub (themed): oben umschalten zwischen Freiem Training und Trainingsplan.
// Freies Training: Koerperregion (Karte/Koerper) antippen -> gefilterte Uebungen -> Detail.
// Zurueck per Wischen zeigt die vorherige Seite dahinter (SwipeBack mit `behind`).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import ExerciseDetail from '../components/ExerciseDetail';
import Segmented from '../components/Segmented';
import PlanScreen, { Selected } from './PlanScreen';
import { useFocusTick } from '../lib/useFocusTick';
import { TAB_BAR_SPACE } from '../lib/layout';
import ErrorRetry from '../components/ErrorRetry';
import { errorMessage } from '../lib/errors';
import { DIFF_LABELS, EQUIP_LABELS, ALLOWED_DIFF, ALLOWED_EQUIP } from '../lib/training';
import { createCustomExercise, deleteCustomExercise } from '../lib/customExercises';
import { CARD_SHADOW as shadow } from '../lib/ui';
import BodyMuscleMap from '../components/BodyMuscleMap';
import BackButton from '../components/BackButton';
import SwipeBack from '../components/SwipeBack';
import { useAndroidBack } from '../lib/useBackHandler';
import GlassFill from '../components/GlassFill';
import { usePaywall } from '../components/Paywall';

type Muscle = { id: string; key: string; name_de: string; body_region: string | null };
type Exercise = { id: string; name: string; difficulty: string; equipment: string; description: string | null; instructions: string | null };

// Reihenfolge je Muskel-Key (clientseitig, damit die Anordnung stabil bleibt).
const MUSCLE_ORDER = ['chest', 'back', 'shoulders', 'neck', 'biceps', 'triceps', 'abs', 'legs', 'glutes', 'calves'];

export default function TrainingScreen({ focusTick, focused = true }: { focusTick?: number; focused?: boolean }) {
  const { profile, isPremium, session } = useAuth();
  const { openPaywall } = usePaywall();
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [seg, setSeg] = useState<'free' | 'plan'>('free');
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [selectedMuscle, setSelectedMuscle] = useState<Muscle | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [moreCount, setMoreCount] = useState(0); // wie viele Uebungen Free zusaetzlich verpasst
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [mLoading, setMLoading] = useState(true);
  const [mError, setMError] = useState<string | null>(null);
  const [exError, setExError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [planEx, setPlanEx] = useState<Selected | null>(null);
  const [planRefresh, setPlanRefresh] = useState(0);
  const [customIds, setCustomIds] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEquip, setNewEquip] = useState('bodyweight');
  const [creating, setCreating] = useState(false);

  // Android-System-Zurueck: tiefste offene Ebene zuerst schliessen (genau wie das
  // Wischen vom Rand). Auf der Startebene false -> der globale Handler (MainTabs) uebernimmt.
  useAndroidBack(() => {
    if (planEx) { setPlanEx(null); setPlanRefresh((n) => n + 1); return true; }
    if (selectedExercise) { setSelectedExercise(null); return true; }
    if (selectedMuscle) { setSelectedMuscle(null); return true; }
    return false;
  }, focused);

  const allowedDiff = ALLOWED_DIFF[profile?.experience_level ?? 'beginner'] ?? ['beginner'];
  const allowedEquip = ALLOWED_EQUIP[profile?.training_environment ?? 'gym'] ?? ALLOWED_EQUIP.gym;

  const orderedMuscles = useMemo(() => {
    const byKey: Record<string, Muscle> = {};
    muscles.forEach((m) => { byKey[m.key] = m; });
    const ordered = MUSCLE_ORDER.map((k) => byKey[k]).filter(Boolean) as Muscle[];
    const extra = muscles.filter((m) => !MUSCLE_ORDER.includes(m.key));
    return [...ordered, ...extra];
  }, [muscles]);

  const loadMuscles = useCallback(async (silent = false) => {
    if (!silent) setMLoading(true);
    try {
      const { data, error } = await supabase.from('muscles').select('id, key, name_de, body_region').order('name_de');
      if (error) throw error;
      setMuscles(data ?? []);
      setMError(null);
    } catch (e) {
      setMError(errorMessage(e));
    } finally {
      setMLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadMuscles(); }, [loadMuscles]);

  function onRefresh() {
    setRefreshing(true);
    loadMuscles(true);
  }

  useFocusTick(focusTick, () => {
    setSeg('free');
    setSelectedExercise(null);
    setSelectedMuscle(null);
    setPlanEx(null);
  });

  async function openMuscle(m: Muscle) {
    setSelectedMuscle(m);
    setSelectedExercise(null);
    setLoadingExercises(true);
    setExError(null);
    try {
      const uid = session?.user?.id;
      const SEL = 'id, name, difficulty, equipment, description, instructions';
      // Globale Uebungen (created_by null) gefiltert. Faellt zurueck auf die alte Query,
      // falls die Spalte created_by noch fehlt (Migration 050 noch nicht eingespielt).
      let globals: Exercise[] = [];
      let customs: Exercise[] = [];
      const globRes = await supabase.from('exercises').select(SEL).eq('primary_muscle_id', m.id).is('created_by', null).in('difficulty', allowedDiff).in('equipment', allowedEquip).order('difficulty');
      if (globRes.error) {
        const allRes = await supabase.from('exercises').select(SEL).eq('primary_muscle_id', m.id).in('difficulty', allowedDiff).in('equipment', allowedEquip).order('difficulty');
        if (allRes.error) throw allRes.error;
        globals = (allRes.data ?? []) as Exercise[];
      } else {
        globals = (globRes.data ?? []) as Exercise[];
        if (uid) {
          // Eigene Uebungen (ohne Schwierigkeits-/Equipment-Filter -> immer sichtbar).
          const custRes = await supabase.from('exercises').select(SEL).eq('primary_muscle_id', m.id).eq('created_by', uid).order('name');
          customs = (custRes.data ?? []) as Exercise[];
        }
      }
      setCustomIds(new Set(customs.map((x) => x.id)));
      // Gratis: globale Auswahl begrenzt; eigene Uebungen IMMER zeigen.
      const limited = isPremium ? globals : globals.slice(0, 4);
      setExercises([...customs, ...limited]);
      setMoreCount(isPremium ? 0 : Math.max(0, globals.length - 4));
    } catch (e) {
      setExError(errorMessage(e));
    } finally {
      setLoadingExercises(false);
    }
  }

  async function doCreate() {
    const uid = session?.user?.id;
    const name = newName.trim();
    if (!uid || !selectedMuscle || !name || creating) return;
    setCreating(true);
    const id = await createCustomExercise(uid, name, selectedMuscle.id, newEquip);
    setCreating(false);
    if (!id) { Alert.alert(t('training.createFailed')); return; }
    setShowCreate(false);
    openMuscle(selectedMuscle); // Liste neu laden -> eigene Uebung erscheint
  }

  function confirmDeleteCustom(ex: Exercise) {
    Alert.alert(t('training.deleteCustomTitle', { name: ex.name }), t('training.deleteCustomBody'), [
      { text: t('exercise.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => { const ok = await deleteCustomExercise(ex.id); if (ok) { if (selectedMuscle) openMuscle(selectedMuscle); } else Alert.alert(t('training.deleteCustomFailed')); } },
    ]);
  }

  // Stabiler Callback fuer das Koerper-Modell, damit BodyMuscleMap (schweres SVG)
  // NICHT bei jedem openMuscle-Re-Render neu gezeichnet wird (sonst spuerbare Verzoegerung).
  const openMuscleRef = useRef(openMuscle);
  openMuscleRef.current = openMuscle;
  const openMuscleByKey = useCallback((key: string) => {
    const m = muscles.find((x) => x.key === key);
    if (m) openMuscleRef.current(m);
  }, [muscles]);

  // Umschalt-Leiste (Freies Training / Trainingsplan). Im Freien Training Teil des
  // Scroll-Inhalts -> scrollt beim Runterscrollen mit weg; sonst fest oben.
  const segmented = (
    <Segmented
      options={[{ key: 'free', label: t('training.segFree') }, { key: 'plan', label: t('training.segPlan') }]}
      value={seg}
      onChange={(k) => { if (k === 'plan' && !isPremium) { openPaywall('plan'); return; } setSeg(k as 'free' | 'plan'); }}
      c={c}
    />
  );

  // --- Ansichten als Variablen (damit beim Zurueckwischen die Vorseite dahinter sichtbar ist) ---
  const hubView = (
    <View style={styles.container}>
      <Text style={styles.title}>{t('training.title')}</Text>
      <View style={{ height: 14 }} />
      {seg === 'plan' ? (
        <>
          {segmented}
          <View style={{ flex: 1, marginTop: 14 }}>
            <PlanScreen embedded onOpenExercise={setPlanEx} refreshTick={planRefresh} />
          </View>
        </>
      ) : mLoading ? (
        <>
          {segmented}
          <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} />
        </>
      ) : mError ? (
        <>
          {segmented}
          <ErrorRetry message={mError} onRetry={() => loadMuscles()} />
        </>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingTop: 0, paddingBottom: TAB_BAR_SPACE }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
        >
          {segmented}
          <View style={{ height: 18 }} />
          <View style={styles.bodyCard}>
            <GlassFill radius={20} />
            <BodyMuscleMap
              onSelect={openMuscleByKey}
              c={c}
              gender={profile?.gender === 'female' ? 'female' : 'male'}
            />
          </View>
          <Text style={styles.sectionLabel}>{t('training.orFromList')}</Text>
          <View style={styles.muscleList}>
            <GlassFill radius={20} />
            {orderedMuscles.map((m, idx) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.muscleRow, idx > 0 && styles.muscleRowDivider]}
                onPress={() => openMuscle(m)}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel={t('training.a11yShowExercises', { name: m.name_de })}
              >
                <Text style={styles.muscleRowName}>{m.name_de}</Text>
                <Text style={styles.muscleRowChev}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );

  const listView = selectedMuscle ? (
    <View style={styles.container}>
      <BackButton onPress={() => setSelectedMuscle(null)} c={c} />
      <Text style={styles.title}>{selectedMuscle.name_de}</Text>
      <Text style={styles.subtitle}>{t('training.subtitle')}</Text>
      {loadingExercises ? (
        <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 24 }} />
      ) : exError ? (
        <ErrorRetry message={exError} onRetry={() => openMuscle(selectedMuscle)} />
      ) : exercises.length === 0 ? (
        <View style={styles.note}>
          <GlassFill radius={20} />
          <Text style={styles.noteText}>{t('training.noExercises')}</Text>
        </View>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(ex) => ex.id}
          contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          ListHeaderComponent={<Text style={styles.countHint}>{!isPremium && moreCount > 0 ? t('training.freeBasicsHint') : (exercises.length === 1 ? t('training.exerciseCountOne', { n: exercises.length }) : t('training.exerciseCountMany', { n: exercises.length }))}</Text>}
          ListFooterComponent={
            <>
              {!isPremium && moreCount > 0 && (
                <TouchableOpacity style={styles.exRow} onPress={() => openPaywall('exercises')} activeOpacity={0.7}>
                  <View style={styles.lockChip}>
                    <Ionicons name="lock-closed" size={17} color={c.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exName}>{moreCount === 1 ? t('training.moreLockedOne', { n: moreCount }) : t('training.moreLockedMany', { n: moreCount })}</Text>
                    <Text style={styles.exMeta}>{t('training.moreLockedHint')}</Text>
                  </View>
                  <Text style={styles.chev}>›</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.exRow} onPress={() => { setNewName(''); setNewEquip('bodyweight'); setShowCreate(true); }} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('training.createCustom')}>
                <View style={styles.lockChip}><Ionicons name="add" size={20} color={c.primary} /></View>
                <Text style={[styles.exName, { flex: 1, color: c.primary }]}>{t('training.createCustom')}</Text>
              </TouchableOpacity>
            </>
          }
          renderItem={({ item: ex }) => {
            const mine = customIds.has(ex.id);
            return (
              <TouchableOpacity style={styles.exRow} onPress={() => setSelectedExercise(ex)} onLongPress={mine ? () => confirmDeleteCustom(ex) : undefined} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exName}>{ex.name}</Text>
                  <Text style={styles.exMeta}>{mine ? `${t('training.customBadge')} · ` : ''}{DIFF_LABELS[ex.difficulty] ?? ex.difficulty} · {EQUIP_LABELS[ex.equipment] ?? ex.equipment}</Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  ) : null;

  // Eine einzige Rueckgabe: der Hub (mit dem schweren Koerper-Modell) bleibt IMMER
  // gemountet als unterste Ebene -> wird beim Antippen nie neu aufgebaut (schnell)
  // und erscheint beim Zurueckwischen automatisch unter der daruebergelegten Ansicht.
  return (
    <View style={{ flex: 1 }}>
      <View style={StyleSheet.absoluteFill} pointerEvents={selectedMuscle || selectedExercise || planEx ? 'none' : 'auto'}>
        {hubView}
      </View>

      {selectedMuscle && !selectedExercise && (
        <View style={StyleSheet.absoluteFill}>
          <SwipeBack key="train-muscle" onBack={() => setSelectedMuscle(null)} c={c}>
            {listView}
          </SwipeBack>
        </View>
      )}

      {selectedExercise && (
        <View style={StyleSheet.absoluteFill}>
          <SwipeBack key="train-exercise" onBack={() => setSelectedExercise(null)} c={c} behind={listView}>
            <ExerciseDetail
              exercise={selectedExercise}
              onBack={() => setSelectedExercise(null)}
              muscleKey={selectedMuscle?.key ?? null}
              muscleName={selectedMuscle?.name_de ?? null}
            />
          </SwipeBack>
        </View>
      )}

      {planEx && (
        <View style={StyleSheet.absoluteFill}>
          <SwipeBack onBack={() => { setPlanEx(null); setPlanRefresh((t) => t + 1); }} c={c}>
            <ExerciseDetail
              exercise={planEx.exercise}
              muscleKey={planEx.muscleKey}
              muscleName={planEx.muscleName}
              targetSets={planEx.targetSets}
              targetReps={planEx.targetReps}
              targetWeight={planEx.targetWeight}
              planExerciseId={planEx.planExerciseId}
              onBack={() => { setPlanEx(null); setPlanRefresh((t) => t + 1); }}
            />
          </SwipeBack>
        </View>
      )}

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('training.createTitle', { muscle: selectedMuscle?.name_de ?? '' })}</Text>
            <TextInput style={styles.modalInput} value={newName} onChangeText={setNewName} placeholder={t('training.createNamePlaceholder')} placeholderTextColor={c.textMuted} maxLength={60} autoCapitalize="sentences" underlineColorAndroid="transparent" />
            <Text style={styles.modalLabel}>{t('training.createEquip')}</Text>
            <View style={styles.equipWrap}>
              {['bodyweight', 'dumbbell', 'barbell', 'machine', 'cable', 'none', 'other'].map((eq) => (
                <TouchableOpacity key={eq} onPress={() => setNewEquip(eq)} style={[styles.equipChip, newEquip === eq && styles.equipChipOn]} activeOpacity={0.85}>
                  <Text style={[styles.equipChipText, newEquip === eq && styles.equipChipTextOn]}>{EQUIP_LABELS[eq]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.modalCreate, creating && { opacity: 0.6 }]} onPress={doCreate} disabled={creating} activeOpacity={0.85}>
              {creating ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.modalCreateText}>{t('training.createCta')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCreate(false)} activeOpacity={0.7}>
              <Text style={styles.modalCancelText}>{t('exercise.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent', paddingTop: 56, paddingHorizontal: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 24 },
    modalCard: { backgroundColor: c.bg, borderRadius: 22, padding: 22, borderWidth: 1, borderColor: c.cardBorder },
    modalTitle: { fontSize: 18, fontWeight: '800', color: c.heading, marginBottom: 14 },
    modalInput: { backgroundColor: c.inputBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: c.text, borderWidth: 1, borderColor: c.border },
    modalLabel: { fontSize: 13, color: c.text, fontWeight: '700', marginTop: 16, marginBottom: 8 },
    equipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    equipChip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.inputBg },
    equipChipOn: { borderColor: c.primary, backgroundColor: 'rgba(25,201,143,0.12)' },
    equipChipText: { fontSize: 14, fontWeight: '700', color: c.textMuted },
    equipChipTextOn: { color: c.primary },
    modalCreate: { backgroundColor: c.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
    modalCreateText: { color: c.onPrimary, fontSize: 16, fontWeight: '800' },
    modalCancel: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
    modalCancelText: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
    title: { fontSize: 28, fontWeight: '800', color: c.heading, letterSpacing: -0.5 },
    subtitle: { fontSize: 15, color: c.textMuted, marginTop: 2, marginBottom: 16 },
    back: { color: c.primary, fontSize: 15, fontWeight: '600', marginBottom: 10 },

    sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: c.textMuted, marginTop: 4, marginBottom: 12 },
    bodyCard: { ...shadow, backgroundColor: c.card, borderRadius: 20, paddingVertical: 18, paddingHorizontal: 14, marginBottom: 8, borderWidth: 1, borderColor: c.cardBorder, alignItems: 'center', overflow: 'hidden' },

    muscleList: { ...shadow, backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    muscleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 16 },
    muscleRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    muscleRowName: { fontSize: 15, fontWeight: '600', color: c.text },
    muscleRowChev: { fontSize: 20, color: c.textMuted, marginLeft: 8 },

    countHint: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: c.textMuted, textTransform: 'uppercase', marginBottom: 12 },
    exRow: { ...shadow, flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: c.cardBorder },
    exName: { fontSize: 17, fontWeight: '600', color: c.text },
    exMeta: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    chev: { fontSize: 24, color: c.textMuted, marginLeft: 8 },
    // Icon-Chip fuer die Premium-Sperre (ersetzt das frühere Schloss-Emoji im Text).
    lockChip: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(25,201,143,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    note: { backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: 1, borderRadius: 20, padding: 16, marginTop: 16, overflow: 'hidden' },
    noteText: { fontSize: 14, color: c.textMuted, lineHeight: 20 },
  });
}
