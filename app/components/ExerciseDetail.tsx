// Übungsdetail mit "Training mitschreiben": Sätze (Wiederholungen + Gewicht) speichern.
// Eine Trainings-Session pro Tag wird bei Bedarf automatisch angelegt (lazy).
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type Exercise = {
  id: string;
  name: string;
  difficulty: string;
  equipment: string;
  description: string | null;
  instructions: string | null;
};
type SetLog = { id: string; set_index: number; reps: number | null; weight_kg: number | null };

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

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function ExerciseDetail({ exercise, onBack }: { exercise: Exercise; onBack: () => void }) {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sets, setSets] = useState<SetLog[]>([]);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');

  // Beim Öffnen: heutige Session suchen (NICHT anlegen) und Sätze für diese Übung laden.
  useEffect(() => {
    let active = true;
    async function init() {
      if (!userId) { setLoading(false); return; }
      setLoading(true);
      const { data: existing } = await supabase
        .from('workout_sessions')
        .select('id')
        .eq('user_id', userId)
        .gte('performed_at', startOfTodayISO())
        .order('performed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      const sid = existing?.id ?? null;
      setSessionId(sid);
      if (sid) await refreshSets(sid);
      if (active) setLoading(false);
    }
    init();
    return () => { active = false; };
  }, [userId, exercise.id]);

  async function refreshSets(sid: string) {
    const { data } = await supabase
      .from('set_logs')
      .select('id, set_index, reps, weight_kg')
      .eq('session_id', sid)
      .eq('exercise_id', exercise.id)
      .order('set_index');
    setSets(data ?? []);
  }

  async function saveSet() {
    setError(null);
    const r = parseInt(reps, 10);
    if (!r || r <= 0) {
      setError('Bitte gültige Wiederholungen eingeben.');
      return;
    }
    const w = weight.trim() ? Number(weight.replace(',', '.')) : null;
    if (!userId) return;

    setSaving(true);

    // Heutige Session bei Bedarf jetzt anlegen
    let sid = sessionId;
    if (!sid) {
      const { data: created, error: cErr } = await supabase
        .from('workout_sessions')
        .insert({ user_id: userId })
        .select('id')
        .single();
      if (cErr || !created) {
        setError(cErr?.message ?? 'Session konnte nicht angelegt werden.');
        setSaving(false);
        return;
      }
      sid = created.id;
      setSessionId(sid);
    }

    if (!sid) {
      setSaving(false);
      return;
    }

    const { error: iErr } = await supabase.from('set_logs').insert({
      user_id: userId,
      session_id: sid,
      exercise_id: exercise.id,
      set_index: sets.length + 1,
      reps: r,
      weight_kg: w,
    });

    if (iErr) setError(iErr.message);
    else {
      await refreshSets(sid);
      setReps(''); // Gewicht bleibt stehen (oft gleich fuer naechsten Satz)
    }
    setSaving(false);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>‹ Zurück</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{exercise.name}</Text>
      <View style={styles.badges}>
        <Text style={styles.badge}>{DIFF_LABELS[exercise.difficulty] ?? exercise.difficulty}</Text>
        <Text style={styles.badge}>{EQUIP_LABELS[exercise.equipment] ?? exercise.equipment}</Text>
      </View>
      {exercise.description ? <Text style={styles.desc}>{exercise.description}</Text> : null}
      {exercise.instructions ? (
        <>
          <Text style={styles.h2}>Ausführung</Text>
          <Text style={styles.instr}>{exercise.instructions}</Text>
        </>
      ) : null}

      <View style={styles.logCard}>
        <Text style={styles.h2}>Training mitschreiben</Text>

        {loading ? (
          <ActivityIndicator color="#1F3864" style={{ marginVertical: 12 }} />
        ) : (
          <>
            {sets.length > 0 ? (
              <View style={styles.setList}>
                {sets.map((s) => (
                  <View key={s.id} style={styles.setRow}>
                    <Text style={styles.setIdx}>Satz {s.set_index}</Text>
                    <Text style={styles.setVal}>
                      {s.reps} Wdh{s.weight_kg ? ` × ${s.weight_kg} kg` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.hint}>Noch keine Sätze heute – trag deinen ersten ein:</Text>
            )}

            <View style={styles.inputRow}>
              <View style={styles.inputCol}>
                <Text style={styles.inputLabel}>Wiederholungen</Text>
                <TextInput
                  style={styles.input}
                  value={reps}
                  onChangeText={setReps}
                  placeholder="z. B. 10"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={styles.inputLabel}>Gewicht (kg)</Text>
                <TextInput
                  style={styles.input}
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="optional"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={saveSet} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>✓ Satz speichern</Text>}
            </TouchableOpacity>

            {sets.length > 0 && (
              <Text style={styles.doneHint}>{sets.length} Satz{sets.length === 1 ? '' : 'e'} heute gespeichert 💪</Text>
            )}
            {error && <Text style={styles.error}>{error}</Text>}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F5FA', paddingTop: 60, paddingHorizontal: 20 },
  back: { color: '#2E5496', fontSize: 15, fontWeight: '600', marginBottom: 10 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1F3864' },
  badges: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 16 },
  badge: { backgroundColor: '#EAF1FB', color: '#2E5496', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, fontSize: 13, overflow: 'hidden' },
  desc: { fontSize: 15, color: '#444', lineHeight: 22, marginBottom: 16 },
  h2: { fontSize: 17, fontWeight: '700', color: '#1F3864', marginBottom: 8 },
  instr: { fontSize: 15, color: '#444', lineHeight: 24, marginBottom: 8 },

  logCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginTop: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  hint: { fontSize: 14, color: '#777', marginBottom: 12 },
  setList: { marginBottom: 12 },
  setRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomColor: '#EEF1F6', borderBottomWidth: 1 },
  setIdx: { fontSize: 15, color: '#8A97A8', fontWeight: '600' },
  setVal: { fontSize: 15, color: '#222', fontWeight: '600' },
  inputRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  inputCol: { flex: 1 },
  inputLabel: { fontSize: 13, color: '#444', fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#CFD8E3', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: '#fff' },
  saveBtn: { backgroundColor: '#1F3864', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  doneHint: { fontSize: 13, color: '#1a7f37', fontWeight: '600', textAlign: 'center', marginTop: 12 },
  error: { color: '#B00020', fontSize: 14, marginTop: 12, textAlign: 'center' },
});
