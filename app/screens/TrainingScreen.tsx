// Trainingsbereich (themed): Muskelgruppe -> gefilterte Übungen -> Detail.
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import ExerciseDetail from '../components/ExerciseDetail';

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
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [loadingMuscles, setLoadingMuscles] = useState(true);
  const [selectedMuscle, setSelectedMuscle] = useState<Muscle | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  const allowedDiff = ALLOWED_DIFF[profile?.experience_level ?? 'beginner'] ?? ['beginner'];
  const allowedEquip = ALLOWED_EQUIP[profile?.training_environment ?? 'gym'] ?? ALLOWED_EQUIP.gym;

  useEffect(() => {
    supabase.from('muscles').select('id, key, name_de, body_region').order('name_de').then(({ data }) => {
      setMuscles(data ?? []);
      setLoadingMuscles(false);
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

  if (selectedExercise) {
    return <ExerciseDetail exercise={selectedExercise} onBack={() => setSelectedExercise(null)} />;
  }

  if (selectedMuscle) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => setSelectedMuscle(null)}>
          <Text style={styles.back}>‹ Muskelgruppen</Text>
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Training</Text>
      <Text style={styles.subtitle}>Wähle eine Muskelgruppe</Text>
      {loadingMuscles ? (
        <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {muscles.map((m) => (
            <TouchableOpacity key={m.id} style={styles.tile} onPress={() => openMuscle(m)} activeOpacity={0.8}>
              <Text style={styles.tileText}>{m.name_de}</Text>
            </TouchableOpacity>
          ))}
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
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: 40 },
    tile: { width: '31%', aspectRatio: 1, backgroundColor: c.card, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12, paddingHorizontal: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    tileText: { fontSize: 15, fontWeight: '600', color: c.heading, textAlign: 'center' },
    exRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 16, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    exName: { fontSize: 17, fontWeight: '600', color: c.text },
    exMeta: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    chev: { fontSize: 24, color: c.textMuted, marginLeft: 8 },
    note: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 10, padding: 14, marginTop: 16 },
    noteText: { fontSize: 14, color: c.textMuted, lineHeight: 20 },
  });
}
