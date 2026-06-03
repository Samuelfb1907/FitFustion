// Training-Hub (themed): oben umschalten zwischen Freiem Training und Trainingsplan.
// Freies Training: Muskel am Koerper antippen (oder Liste) -> gefilterte Uebungen -> Detail.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import ExerciseDetail from '../components/ExerciseDetail';
import BodyMuscleMap from '../components/BodyMuscleMap';
import Segmented from '../components/Segmented';
import PlanScreen from './PlanScreen';
import { useFocusTick } from '../lib/useFocusTick';
import ErrorRetry from '../components/ErrorRetry';
import { errorMessage } from '../lib/errors';
import { DIFF_LABELS, EQUIP_LABELS, ALLOWED_DIFF, ALLOWED_EQUIP } from '../lib/training';
import { CARD_SHADOW as shadow } from '../lib/ui';

type Muscle = { id: string; key: string; name_de: string; body_region: string | null };
type Exercise = { id: string; name: string; difficulty: string; equipment: string; description: string | null; instructions: string | null };

// Schwierigkeits-/Equipment-Konstanten -> lib/training.ts

export default function TrainingScreen({ focusTick }: { focusTick?: number }) {
  const { profile } = useAuth();
  const c = useColors();
  const styles = makeStyles(c);

  const [seg, setSeg] = useState<'free' | 'plan'>('free');
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [selectedMuscle, setSelectedMuscle] = useState<Muscle | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [pickedMuscle, setPickedMuscle] = useState<Muscle | null>(null);
  const [mLoading, setMLoading] = useState(true);
  const [mError, setMError] = useState<string | null>(null);
  const [exError, setExError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const allowedDiff = ALLOWED_DIFF[profile?.experience_level ?? 'beginner'] ?? ['beginner'];
  const allowedEquip = ALLOWED_EQUIP[profile?.training_environment ?? 'gym'] ?? ALLOWED_EQUIP.gym;

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

  // Reiter erneut angetippt -> zurueck zur Startansicht (Muskel-Auswahl, Freies Training)
  useFocusTick(focusTick, () => {
    setSeg('free');
    setSelectedExercise(null);
    setSelectedMuscle(null);
    setPickedMuscle(null);
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
  function pickByKey(key: string) {
    const m = muscles.find((x) => x.key === key);
    if (m) setPickedMuscle(m);
  }

  // Übungsdetail = volle Ansicht
  if (selectedExercise) {
    return <ExerciseDetail exercise={selectedExercise} onBack={() => setSelectedExercise(null)} muscleKey={selectedMuscle?.key ?? null} muscleName={selectedMuscle?.name_de ?? null} />;
  }

  // Übungsliste für den gewählten Muskel
  if (selectedMuscle) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => setSelectedMuscle(null)}>
          <Text style={styles.back}>‹ Körper</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{selectedMuscle.name_de}</Text>
        <Text style={styles.subtitle}>Passend zu deinem Level & deiner Umgebung</Text>
        {loadingExercises ? (
          <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 24 }} />
        ) : exError ? (
          <ErrorRetry message={exError} onRetry={() => openMuscle(selectedMuscle)} />
        ) : exercises.length === 0 ? (
          <View style={styles.note}>
            <Text style={styles.noteText}>Keine passenden Übungen gefunden. Tipp: Mit mehr Equipment (Profil) schaltest du weitere frei.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            {exercises.map((ex) => (
              <TouchableOpacity key={ex.id} style={styles.exRow} onPress={() => setSelectedExercise(ex)} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exName}>{ex.name}</Text>
                  <Text style={styles.exMeta}>{DIFF_LABELS[ex.difficulty] ?? ex.difficulty} · {EQUIP_LABELS[ex.equipment] ?? ex.equipment}</Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  // Hub: Umschalter + Inhalt
  return (
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
          <PlanScreen embedded />
        </View>
      ) : mLoading ? (
        <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} />
      ) : mError ? (
        <ErrorRetry message={mError} onRetry={() => loadMuscles()} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingTop: 18, paddingBottom: 40, alignItems: 'center' }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
        >
          <BodyMuscleMap onSelect={pickByKey} selectedKey={pickedMuscle?.key ?? null} c={c} gender={profile?.gender === 'female' ? 'female' : 'male'} />
          {pickedMuscle && (
            <TouchableOpacity style={styles.cta} onPress={() => openMuscle(pickedMuscle)} activeOpacity={0.85}>
              <Text style={styles.ctaText}>Übungen für {pickedMuscle.name_de} anzeigen  ›</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.orHint}>Muskel auswählen 👇</Text>
          <View style={styles.chips}>
            {muscles.map((m) => {
              const active = pickedMuscle?.id === m.id;
              return (
                <TouchableOpacity key={m.id} style={[styles.chip, active && styles.chipActive]} onPress={() => openMuscle(m)} activeOpacity={0.8}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.name_de}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 56, paddingHorizontal: 16 },
    title: { fontSize: 26, fontWeight: '800', color: c.heading },
    subtitle: { fontSize: 15, color: c.textMuted, marginTop: 2, marginBottom: 16 },
    back: { color: c.primary, fontSize: 15, fontWeight: '600', marginBottom: 10 },
    orHint: { fontSize: 16, fontWeight: '800', color: c.heading, marginTop: 22, marginBottom: 12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
    chip: { ...shadow, backgroundColor: c.card, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: 15, fontWeight: '700', color: c.heading },
    chipTextActive: { color: c.onPrimary },
    cta: { backgroundColor: c.primary, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 20, marginTop: 16, width: '100%', maxWidth: 320, alignItems: 'center' },
    ctaText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
    exRow: { ...shadow, flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 16, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    exName: { fontSize: 17, fontWeight: '600', color: c.text },
    exMeta: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    chev: { fontSize: 24, color: c.textMuted, marginLeft: 8 },
    note: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 16 },
    noteText: { fontSize: 14, color: c.textMuted, lineHeight: 20 },
  });
}
