// Training-Hub (themed): oben umschalten zwischen Freiem Training und Trainingsplan.
// Freies Training: Koerperregion (Karte/Koerper) antippen -> gefilterte Uebungen -> Detail.
// Zurueck per Wischen zeigt die vorherige Seite dahinter (SwipeBack mit `behind`).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import ExerciseDetail from '../components/ExerciseDetail';
import Segmented from '../components/Segmented';
import PlanScreen, { Selected } from './PlanScreen';
import { useFocusTick } from '../lib/useFocusTick';
import ErrorRetry from '../components/ErrorRetry';
import { errorMessage } from '../lib/errors';
import { DIFF_LABELS, EQUIP_LABELS, ALLOWED_DIFF, ALLOWED_EQUIP } from '../lib/training';
import { CARD_SHADOW as shadow } from '../lib/ui';
import BodyMuscleMap from '../components/BodyMuscleMap';
import BackButton from '../components/BackButton';
import SwipeBack from '../components/SwipeBack';
import GlassFill from '../components/GlassFill';

type Muscle = { id: string; key: string; name_de: string; body_region: string | null };
type Exercise = { id: string; name: string; difficulty: string; equipment: string; description: string | null; instructions: string | null };

// Reihenfolge je Muskel-Key (clientseitig, damit die Anordnung stabil bleibt).
const MUSCLE_ORDER = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'abs', 'legs', 'glutes', 'calves'];

export default function TrainingScreen({ focusTick }: { focusTick?: number }) {
  const { profile } = useAuth();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [seg, setSeg] = useState<'free' | 'plan'>('free');
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [selectedMuscle, setSelectedMuscle] = useState<Muscle | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [mLoading, setMLoading] = useState(true);
  const [mError, setMError] = useState<string | null>(null);
  const [exError, setExError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [planEx, setPlanEx] = useState<Selected | null>(null);
  const [planRefresh, setPlanRefresh] = useState(0);

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
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name, difficulty, equipment, description, instructions')
        .eq('primary_muscle_id', m.id)
        .in('difficulty', allowedDiff)
        .in('equipment', allowedEquip)
        .order('difficulty');
      if (error) throw error;
      setExercises(data ?? []);
    } catch (e) {
      setExError(errorMessage(e));
    } finally {
      setLoadingExercises(false);
    }
  }

  // --- Ansichten als Variablen (damit beim Zurueckwischen die Vorseite dahinter sichtbar ist) ---
  const hubView = (
    <View style={styles.container}>
      <Text style={styles.title}>Training</Text>
      <View style={{ height: 14 }} />
      <Segmented
        options={[{ key: 'free', label: 'Freies Training' }, { key: 'plan', label: 'Trainingsplan' }]}
        value={seg}
        onChange={(k) => setSeg(k as 'free' | 'plan')}
        c={c}
      />
      {seg === 'plan' ? (
        <View style={{ flex: 1, marginTop: 14 }}>
          <PlanScreen embedded onOpenExercise={setPlanEx} refreshTick={planRefresh} />
        </View>
      ) : mLoading ? (
        <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} />
      ) : mError ? (
        <ErrorRetry message={mError} onRetry={() => loadMuscles()} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingTop: 18, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
        >
          <View style={styles.bodyCard}>
            <GlassFill radius={16} />
            <BodyMuscleMap
              onSelect={(key) => { const m = muscles.find((x) => x.key === key); if (m) openMuscle(m); }}
              c={c}
              gender={profile?.gender === 'female' ? 'female' : 'male'}
            />
          </View>
          <Text style={styles.sectionLabel}>ODER AUS DER LISTE</Text>
          <View style={styles.muscleList}>
            <GlassFill radius={14} />
            {orderedMuscles.map((m, idx) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.muscleRow, idx > 0 && styles.muscleRowDivider]}
                onPress={() => openMuscle(m)}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel={`Übungen für ${m.name_de} anzeigen`}
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
      <Text style={styles.subtitle}>Passend zu deinem Level & deiner Umgebung</Text>
      {loadingExercises ? (
        <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 24 }} />
      ) : exError ? (
        <ErrorRetry message={exError} onRetry={() => openMuscle(selectedMuscle)} />
      ) : exercises.length === 0 ? (
        <View style={styles.note}>
          <GlassFill radius={16} />
          <Text style={styles.noteText}>Keine passenden Übungen gefunden. Tipp: Mit mehr Equipment (Profil) schaltest du weitere frei.</Text>
        </View>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(ex) => ex.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          ListHeaderComponent={<Text style={styles.countHint}>{exercises.length} {exercises.length === 1 ? 'Übung' : 'Übungen'}</Text>}
          renderItem={({ item: ex }) => (
            <TouchableOpacity style={styles.exRow} onPress={() => setSelectedExercise(ex)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={styles.exName}>{ex.name}</Text>
                <Text style={styles.exMeta}>{DIFF_LABELS[ex.difficulty] ?? ex.difficulty} · {EQUIP_LABELS[ex.equipment] ?? ex.equipment}</Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  ) : null;

  if (selectedExercise) {
    return (
      <SwipeBack key="train-exercise" onBack={() => setSelectedExercise(null)} c={c} behind={listView}>
        <ExerciseDetail
          exercise={selectedExercise}
          onBack={() => setSelectedExercise(null)}
          muscleKey={selectedMuscle?.key ?? null}
          muscleName={selectedMuscle?.name_de ?? null}
        />
      </SwipeBack>
    );
  }

  if (selectedMuscle) {
    return (
      <SwipeBack key="train-muscle" onBack={() => setSelectedMuscle(null)} c={c} behind={hubView}>
        {listView}
      </SwipeBack>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {hubView}
      {planEx && (
        <View style={StyleSheet.absoluteFill}>
          <SwipeBack onBack={() => { setPlanEx(null); setPlanRefresh((t) => t + 1); }} c={c}>
            <ExerciseDetail
              exercise={planEx.exercise}
              muscleKey={planEx.muscleKey}
              muscleName={planEx.muscleName}
              onBack={() => { setPlanEx(null); setPlanRefresh((t) => t + 1); }}
            />
          </SwipeBack>
        </View>
      )}
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent', paddingTop: 56, paddingHorizontal: 16 },
    title: { fontSize: 26, fontWeight: '800', color: c.heading },
    subtitle: { fontSize: 15, color: c.textMuted, marginTop: 2, marginBottom: 16 },
    back: { color: c.primary, fontSize: 15, fontWeight: '600', marginBottom: 10 },

    sectionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: c.textMuted, marginTop: 4, marginBottom: 12 },
    bodyCard: { ...shadow, backgroundColor: c.card, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 14, marginBottom: 8, borderWidth: 1, borderColor: c.cardBorder, alignItems: 'center' },

    muscleList: { ...shadow, backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.cardBorder },
    muscleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 16 },
    muscleRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    muscleRowName: { fontSize: 15, fontWeight: '600', color: c.text },
    muscleRowChev: { fontSize: 20, color: c.textMuted, marginLeft: 8 },

    countHint: { fontSize: 13, color: c.textMuted, marginBottom: 10 },
    exRow: { ...shadow, flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: c.cardBorder },
    exName: { fontSize: 17, fontWeight: '600', color: c.text },
    exMeta: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    chev: { fontSize: 24, color: c.textMuted, marginLeft: 8 },
    note: { backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 16 },
    noteText: { fontSize: 14, color: c.textMuted, lineHeight: 20 },
  });
}
