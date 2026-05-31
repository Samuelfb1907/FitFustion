// Training-Hub (themed): oben umschalten zwischen Freiem Training und Trainingsplan.
// Freies Training: Muskel am Koerper antippen (oder Liste) -> gefilterte Uebungen -> Detail.
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import ExerciseDetail from '../components/ExerciseDetail';
import BodyMuscleMap from '../components/BodyMuscleMap';
import Segmented from '../components/Segmented';
import PlanScreen from './PlanScreen';

type Muscle = { id: string; key: string; name_de: string; body_region: string | null };
type Exercise = { id: string; name: string; difficulty: string; equipment: string; description: string | null; instructions: string | null };

const DIFF_LABELS: Record<string, string> = { beginner: 'Anfänger', intermediate: 'Fortgeschritten', advanced: 'Profi' };
const EQUIP_LABELS: Record<string, string> = {
  barbell: 'Langhantel', dumbbell: 'Kurzhantel', machine: 'Maschine', cable: 'Kabelzug',
  bodyweight: 'Körpergewicht', none: 'Kein Gerät', other: 'Sonstiges',
};
const ALLOWED_DIFF: Record<string, string[]> = {
  beginner: ['beginner'], some: ['beginner', 'intermediate'],
  advanced: ['beginner', 'intermediate', 'advanced'], pro: ['beginner', 'intermediate', 'advanced'],
};
const ALLOWED_EQUIP: Record<string, string[]> = {
  gym: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'none', 'other'],
  home_gym: ['dumbbell', 'bodyweight', 'none', 'other'],
  no_equipment: ['bodyweight', 'none'],
};

export default function TrainingScreen() {
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

  const allowedDiff = ALLOWED_DIFF[profile?.experience_level ?? 'beginner'] ?? ['beginner'];
  const allowedEquip = ALLOWED_EQUIP[profile?.training_environment ?? 'gym'] ?? ALLOWED_EQUIP.gym;

  useEffect(() => {
    supabase.from('muscles').select('id, key, name_de, body_region').order('name_de').then(({ data }) => {
      setMuscles(data ?? []);
    });
  }, []);

  async function openMuscle(m: Muscle) {
    setSelectedMuscle(m);
    setSelectedExercise(null);
    setLoadingExercises(true);
    const { data } = await supabase
      .from('exercises')
      .select('id, name, difficulty, equipment, description, instructions')
      .eq('primary_muscle_id', m.id)
      .in('difficulty', allowedDiff)
      .in('equipment', allowedEquip)
      .order('difficulty');
    setExercises(data ?? []);
    setLoadingExercises(false);
  }
  function pickByKey(key: string) {
    const m = muscles.find((x) => x.key === key);
    if (m) setPickedMuscle(m);
  }

  // Übungsdetail = volle Ansicht
  if (selectedExercise) {
    return <ExerciseDetail exercise={selectedExercise} onBack={() => setSelectedExercise(null)} />;
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
      ) : muscles.length === 0 ? (
        <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 40, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
          <BodyMuscleMap onSelect={pickByKey} selectedKey={pickedMuscle?.key ?? null} c={c} gender={profile?.gender === 'female' ? 'female' : 'male'} />
          {pickedMuscle && (
            <TouchableOpacity style={styles.cta} onPress={() => openMuscle(pickedMuscle)} activeOpacity={0.85}>
              <Text style={styles.ctaText}>Übungen für {pickedMuscle.name_de} anzeigen  ›</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.orHint}>oder wähle aus der Liste</Text>
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
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 60, paddingHorizontal: 20 },
    title: { fontSize: 26, fontWeight: 'bold', color: c.heading },
    subtitle: { fontSize: 15, color: c.textMuted, marginTop: 2, marginBottom: 16 },
    back: { color: c.primary, fontSize: 15, fontWeight: '600', marginBottom: 10 },
    orHint: { fontSize: 13, color: c.textMuted, marginTop: 18, marginBottom: 10 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
    chip: { backgroundColor: c.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: 14, fontWeight: '600', color: c.heading },
    chipTextActive: { color: c.onPrimary },
    cta: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 20, marginTop: 16, width: '100%', maxWidth: 320, alignItems: 'center' },
    ctaText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
    exRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 16, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    exName: { fontSize: 17, fontWeight: '600', color: c.text },
    exMeta: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    chev: { fontSize: 24, color: c.textMuted, marginLeft: 8 },
    note: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 10, padding: 14, marginTop: 16 },
    noteText: { fontSize: 14, color: c.textMuted, lineHeight: 20 },
  });
}
