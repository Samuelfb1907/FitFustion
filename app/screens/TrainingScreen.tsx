// Trainingsbereich: Muskelgruppe wählen -> passende Übungen -> Übungsdetails.
// Filter: Übungen werden nach Erfahrungslevel UND Trainingsumgebung des Nutzers gefiltert.
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type Muscle = { id: string; key: string; name_de: string; body_region: string | null };
type Exercise = {
  id: string;
  name: string;
  difficulty: string;
  equipment: string;
  description: string | null;
  instructions: string | null;
};

const DIFF_LABELS: Record<string, string> = {
  beginner: 'Anfänger',
  intermediate: 'Fortgeschritten',
  advanced: 'Profi',
};
const EQUIP_LABELS: Record<string, string> = {
  barbell: 'Langhantel',
  dumbbell: 'Kurzhantel',
  machine: 'Maschine',
  cable: 'Kabelzug',
  bodyweight: 'Körpergewicht',
  none: 'Kein Gerät',
  other: 'Sonstiges',
};
// Welche Schwierigkeitsgrade sieht welches Erfahrungslevel?
const ALLOWED_DIFF: Record<string, string[]> = {
  beginner: ['beginner'],
  some: ['beginner', 'intermediate'],
  advanced: ['beginner', 'intermediate', 'advanced'],
  pro: ['beginner', 'intermediate', 'advanced'],
};
// Welches Equipment ist in welcher Umgebung verfügbar?
const ALLOWED_EQUIP: Record<string, string[]> = {
  gym: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'none', 'other'],
  home_gym: ['dumbbell', 'bodyweight', 'none', 'other'],
  no_equipment: ['bodyweight', 'none'],
};

export default function TrainingScreen() {
  const { profile } = useAuth();
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [loadingMuscles, setLoadingMuscles] = useState(true);
  const [selectedMuscle, setSelectedMuscle] = useState<Muscle | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  const allowedDiff = ALLOWED_DIFF[profile?.experience_level ?? 'beginner'] ?? ['beginner'];
  const allowedEquip = ALLOWED_EQUIP[profile?.training_environment ?? 'gym'] ?? ALLOWED_EQUIP.gym;

  useEffect(() => {
    supabase
      .from('muscles')
      .select('id, key, name_de, body_region')
      .order('name_de')
      .then(({ data }) => {
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

  // ---- Ansicht 3: Übungsdetail ----
  if (selectedExercise) {
    const ex = selectedExercise;
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <TouchableOpacity onPress={() => setSelectedExercise(null)}>
          <Text style={styles.back}>‹ Zurück</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{ex.name}</Text>
        <View style={styles.badges}>
          <Text style={styles.badge}>{DIFF_LABELS[ex.difficulty] ?? ex.difficulty}</Text>
          <Text style={styles.badge}>{EQUIP_LABELS[ex.equipment] ?? ex.equipment}</Text>
        </View>
        {ex.description ? <Text style={styles.desc}>{ex.description}</Text> : null}
        {ex.instructions ? (
          <>
            <Text style={styles.h2}>Ausführung</Text>
            <Text style={styles.instr}>{ex.instructions}</Text>
          </>
        ) : null}
        <View style={styles.note}>
          <Text style={styles.noteText}>🎬 Animierte 3D-Anleitung folgt in einer späteren Ausbaustufe.</Text>
        </View>
      </ScrollView>
    );
  }

  // ---- Ansicht 2: Übungsliste ----
  if (selectedMuscle) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => setSelectedMuscle(null)}>
          <Text style={styles.back}>‹ Muskelgruppen</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{selectedMuscle.name_de}</Text>
        <Text style={styles.subtitle}>Passend zu deinem Level & deiner Umgebung</Text>
        {loadingExercises ? (
          <ActivityIndicator size="large" color="#1F3864" style={{ marginTop: 24 }} />
        ) : exercises.length === 0 ? (
          <View style={styles.note}>
            <Text style={styles.noteText}>
              Keine passenden Übungen gefunden. Tipp: Mit mehr Equipment (Trainingsumgebung im Profil)
              schaltest du weitere Übungen frei.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            {exercises.map((ex) => (
              <TouchableOpacity key={ex.id} style={styles.exRow} onPress={() => setSelectedExercise(ex)} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exName}>{ex.name}</Text>
                  <Text style={styles.exMeta}>
                    {DIFF_LABELS[ex.difficulty] ?? ex.difficulty} · {EQUIP_LABELS[ex.equipment] ?? ex.equipment}
                  </Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  // ---- Ansicht 1: Muskelauswahl ----
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Training</Text>
      <Text style={styles.subtitle}>Wähle eine Muskelgruppe</Text>
      {loadingMuscles ? (
        <ActivityIndicator size="large" color="#1F3864" style={{ marginTop: 24 }} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F5FA', paddingTop: 60, paddingHorizontal: 20 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1F3864' },
  subtitle: { fontSize: 15, color: '#666', marginTop: 2, marginBottom: 16 },
  back: { color: '#2E5496', fontSize: 15, fontWeight: '600', marginBottom: 10 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: 40 },
  tile: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tileText: { fontSize: 15, fontWeight: '600', color: '#1F3864', textAlign: 'center' },

  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  exName: { fontSize: 17, fontWeight: '600', color: '#222' },
  exMeta: { fontSize: 13, color: '#888', marginTop: 2 },
  chev: { fontSize: 24, color: '#C7CFD9', marginLeft: 8 },

  badges: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  badge: { backgroundColor: '#EAF1FB', color: '#2E5496', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, fontSize: 13, overflow: 'hidden' },
  desc: { fontSize: 15, color: '#444', lineHeight: 22, marginBottom: 16 },
  h2: { fontSize: 17, fontWeight: '700', color: '#1F3864', marginBottom: 8 },
  instr: { fontSize: 15, color: '#444', lineHeight: 24 },

  note: { backgroundColor: '#FFF8E6', borderColor: '#E9D8A6', borderWidth: 1, borderRadius: 10, padding: 14, marginTop: 16 },
  noteText: { fontSize: 14, color: '#7a6a2a', lineHeight: 20 },
});
