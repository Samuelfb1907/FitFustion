// Automatischer Trainingsplan: erzeugt einen Split passend zu den Trainingstagen
// und füllt ihn mit Übungen (gefiltert nach Level & Umgebung). Speichert in
// workout_plans / workout_plan_days / workout_plan_exercises.
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const DIFF_LABELS: Record<string, string> = {
  beginner: 'Anfänger',
  intermediate: 'Fortgeschritten',
  advanced: 'Profi',
};
const ALLOWED_DIFF: Record<string, string[]> = {
  beginner: ['beginner'],
  some: ['beginner', 'intermediate'],
  advanced: ['beginner', 'intermediate', 'advanced'],
  pro: ['beginner', 'intermediate', 'advanced'],
};
const ALLOWED_EQUIP: Record<string, string[]> = {
  gym: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'none', 'other'],
  home_gym: ['dumbbell', 'bodyweight', 'none', 'other'],
  no_equipment: ['bodyweight', 'none'],
};

// Split-Vorlagen je Trainingstage pro Woche
const SPLITS: Record<number, { focus: string; muscles: string[] }[]> = {
  2: [
    { focus: 'Ganzkörper A', muscles: ['chest', 'back', 'legs', 'abs'] },
    { focus: 'Ganzkörper B', muscles: ['shoulders', 'legs', 'glutes', 'back'] },
  ],
  3: [
    { focus: 'Push – Brust, Schultern, Trizeps', muscles: ['chest', 'shoulders', 'triceps'] },
    { focus: 'Pull – Rücken & Bizeps', muscles: ['back', 'biceps'] },
    { focus: 'Beine & Bauch', muscles: ['legs', 'glutes', 'calves', 'abs'] },
  ],
  4: [
    { focus: 'Brust & Trizeps', muscles: ['chest', 'triceps'] },
    { focus: 'Rücken & Bizeps', muscles: ['back', 'biceps'] },
    { focus: 'Beine & Waden', muscles: ['legs', 'glutes', 'calves'] },
    { focus: 'Schultern & Bauch', muscles: ['shoulders', 'abs'] },
  ],
  5: [
    { focus: 'Brust & Trizeps', muscles: ['chest', 'triceps'] },
    { focus: 'Rücken & Bizeps', muscles: ['back', 'biceps'] },
    { focus: 'Beine', muscles: ['legs', 'glutes', 'calves'] },
    { focus: 'Schultern & Bauch', muscles: ['shoulders', 'abs'] },
    { focus: 'Ganzkörper / Schwachstellen', muscles: ['chest', 'back', 'legs'] },
  ],
  6: [
    { focus: 'Push A', muscles: ['chest', 'shoulders', 'triceps'] },
    { focus: 'Pull A', muscles: ['back', 'biceps'] },
    { focus: 'Beine A', muscles: ['legs', 'glutes', 'calves'] },
    { focus: 'Push B', muscles: ['shoulders', 'chest', 'triceps'] },
    { focus: 'Pull B', muscles: ['back', 'biceps'] },
    { focus: 'Beine B & Bauch', muscles: ['legs', 'glutes', 'abs'] },
  ],
};
const DAY_OPTIONS = [2, 3, 4, 5, 6];

type ExView = { id: string; name: string; difficulty: string; sets: number; reps: number };
type DayView = { id: string; day_index: number; focus: string | null; exercises: ExView[] };

export default function PlanScreen() {
  const { session, profile } = useAuth();
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);
  const [days, setDays] = useState<DayView[]>([]);
  const [mode, setMode] = useState<'view' | 'create'>('create');
  const [selectedDays, setSelectedDays] = useState(3);

  const allowedDiff = ALLOWED_DIFF[profile?.experience_level ?? 'beginner'] ?? ['beginner'];
  const allowedEquip = ALLOWED_EQUIP[profile?.training_environment ?? 'gym'] ?? ALLOWED_EQUIP.gym;

  useEffect(() => {
    loadPlan();
  }, [userId]);

  async function loadPlan() {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: plan } = await supabase
      .from('workout_plans')
      .select('id, name')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!plan) {
      setPlanName(null);
      setDays([]);
      setMode('create');
      setLoading(false);
      return;
    }

    const { data: dayRows } = await supabase
      .from('workout_plan_days')
      .select('id, day_index, focus')
      .eq('plan_id', plan.id)
      .order('day_index');

    const dayIds = (dayRows ?? []).map((d: any) => d.id);
    let peRows: any[] = [];
    if (dayIds.length) {
      const { data } = await supabase
        .from('workout_plan_exercises')
        .select('id, plan_day_id, order_index, target_sets, target_reps, exercises(name, difficulty)')
        .in('plan_day_id', dayIds)
        .order('order_index');
      peRows = data ?? [];
    }

    const assembled: DayView[] = (dayRows ?? []).map((d: any) => ({
      id: d.id,
      day_index: d.day_index,
      focus: d.focus,
      exercises: peRows
        .filter((pe: any) => pe.plan_day_id === d.id)
        .map((pe: any) => {
          const ex = Array.isArray(pe.exercises) ? pe.exercises[0] : pe.exercises;
          return {
            id: pe.id,
            name: ex?.name ?? '—',
            difficulty: ex?.difficulty ?? '',
            sets: pe.target_sets ?? 3,
            reps: pe.target_reps ?? 10,
          };
        }),
    }));

    setPlanName(plan.name);
    setDays(assembled);
    setMode('view');
    setLoading(false);
  }

  async function generatePlan(n: number) {
    if (!userId) return;
    setGenerating(true);
    setError(null);
    try {
      // Alte aktive Pläne deaktivieren
      await supabase.from('workout_plans').update({ is_active: false }).eq('user_id', userId).eq('is_active', true);

      // Neuen Plan anlegen
      const { data: plan, error: pErr } = await supabase
        .from('workout_plans')
        .insert({ user_id: userId, name: `Mein ${n}-Tage-Plan`, is_active: true })
        .select('id')
        .single();
      if (pErr || !plan) throw pErr ?? new Error('Plan konnte nicht erstellt werden.');

      const template = SPLITS[n];

      // Muskel-IDs holen
      const allKeys = Array.from(new Set(template.flatMap((d) => d.muscles)));
      const { data: muscleRows } = await supabase.from('muscles').select('id, key').in('key', allKeys);
      const idByKey: Record<string, string> = {};
      (muscleRows ?? []).forEach((m: any) => {
        idByKey[m.key] = m.id;
      });
      const muscleIds = Object.values(idByKey);

      // Passende Übungen holen (gefiltert) und nach Muskel gruppieren
      const { data: exRows } = await supabase
        .from('exercises')
        .select('id, primary_muscle_id, difficulty')
        .in('primary_muscle_id', muscleIds)
        .in('difficulty', allowedDiff)
        .in('equipment', allowedEquip);
      const exByMuscle: Record<string, string[]> = {};
      (exRows ?? []).forEach((e: any) => {
        if (!e.primary_muscle_id) return;
        if (!exByMuscle[e.primary_muscle_id]) exByMuscle[e.primary_muscle_id] = [];
        exByMuscle[e.primary_muscle_id].push(e.id);
      });

      // Tage anlegen
      const dayInsert = template.map((d, i) => ({ user_id: userId, plan_id: plan.id, day_index: i + 1, focus: d.focus }));
      const { data: insertedDays, error: dErr } = await supabase
        .from('workout_plan_days')
        .insert(dayInsert)
        .select('id, day_index');
      if (dErr || !insertedDays) throw dErr ?? new Error('Tage konnten nicht erstellt werden.');

      // Übungen je Tag zuordnen (bis zu 2 pro Muskel)
      const peInsert: any[] = [];
      template.forEach((d, i) => {
        const day = insertedDays.find((x: any) => x.day_index === i + 1);
        if (!day) return;
        let order = 0;
        d.muscles.forEach((mk) => {
          const mid = idByKey[mk];
          const list = (exByMuscle[mid] ?? []).slice(0, 2);
          list.forEach((exId) => {
            peInsert.push({
              user_id: userId,
              plan_day_id: day.id,
              exercise_id: exId,
              target_sets: 3,
              target_reps: 10,
              order_index: order++,
            });
          });
        });
      });
      if (peInsert.length) {
        const { error: peErr } = await supabase.from('workout_plan_exercises').insert(peInsert);
        if (peErr) throw peErr;
      }

      await loadPlan();
    } catch (e: any) {
      setError(e?.message ?? 'Fehler bei der Plan-Erstellung.');
    } finally {
      setGenerating(false);
    }
  }

  // ---- Render ----
  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Trainingsplan</Text>
        <ActivityIndicator size="large" color="#1F3864" style={{ marginTop: 40 }} />
      </View>
    );
  }

  // Plan-Erstellung (kein Plan vorhanden oder "Neu erstellen" gewählt)
  if (mode === 'create') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.title}>Trainingsplan erstellen</Text>
        <Text style={styles.subtitle}>Wie viele Tage pro Woche möchtest du trainieren?</Text>

        <View style={styles.dayPicker}>
          {DAY_OPTIONS.map((n) => {
            const active = selectedDays === n;
            return (
              <TouchableOpacity key={n} style={[styles.dayOpt, active && styles.dayOptActive]} onPress={() => setSelectedDays(n)}>
                <Text style={[styles.dayOptText, active && styles.dayOptTextActive]}>{n}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={[styles.primaryBtn, generating && { opacity: 0.6 }]} onPress={() => generatePlan(selectedDays)} disabled={generating}>
          {generating ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Plan automatisch erstellen</Text>}
        </TouchableOpacity>

        {planName && !generating && (
          <TouchableOpacity onPress={() => setMode('view')}>
            <Text style={styles.link}>Abbrechen</Text>
          </TouchableOpacity>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.hint}>
          Der Plan wird automatisch an dein Level und deine Trainingsumgebung angepasst und gespeichert.
        </Text>
      </ScrollView>
    );
  }

  // Plan anzeigen
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Dein Trainingsplan</Text>
      <Text style={styles.subtitle}>{planName}</Text>

      <TouchableOpacity style={styles.secondaryBtn} onPress={() => setMode('create')}>
        <Text style={styles.secondaryText}>Neuen Plan erstellen</Text>
      </TouchableOpacity>

      {days.map((d) => (
        <View key={d.id} style={styles.dayCard}>
          <Text style={styles.dayTitle}>Tag {d.day_index}</Text>
          <Text style={styles.dayFocus}>{d.focus}</Text>
          {d.exercises.length === 0 ? (
            <Text style={styles.muted}>Keine passenden Übungen – ggf. Umgebung/Level im Profil anpassen.</Text>
          ) : (
            d.exercises.map((ex) => (
              <View key={ex.id} style={styles.exItem}>
                <Text style={styles.exName}>{ex.name}</Text>
                <Text style={styles.exMeta}>
                  {ex.sets} × {ex.reps} · {DIFF_LABELS[ex.difficulty] ?? ex.difficulty}
                </Text>
              </View>
            ))
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F5FA', paddingTop: 60, paddingHorizontal: 20 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1F3864' },
  subtitle: { fontSize: 15, color: '#666', marginTop: 2, marginBottom: 16 },

  dayPicker: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  dayOpt: { width: 52, height: 52, borderRadius: 12, borderWidth: 1, borderColor: '#CFD8E3', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  dayOptActive: { backgroundColor: '#1F3864', borderColor: '#1F3864' },
  dayOptText: { fontSize: 20, fontWeight: '700', color: '#1F3864' },
  dayOptTextActive: { color: '#fff' },

  primaryBtn: { backgroundColor: '#1F3864', borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderColor: '#CFD8E3', backgroundColor: '#fff', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 16 },
  secondaryText: { color: '#2E5496', fontSize: 15, fontWeight: '600' },
  link: { color: '#2E5496', textAlign: 'center', marginTop: 14, fontSize: 14 },
  hint: { fontSize: 13, color: '#9AA5B4', marginTop: 20, lineHeight: 18 },
  error: { color: '#B00020', fontSize: 14, marginTop: 14, textAlign: 'center' },

  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dayTitle: { fontSize: 13, color: '#8A97A8', fontWeight: '700', letterSpacing: 0.5 },
  dayFocus: { fontSize: 18, fontWeight: '700', color: '#1F3864', marginTop: 2, marginBottom: 10 },
  exItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopColor: '#EEF1F6', borderTopWidth: 1 },
  exName: { fontSize: 15, color: '#222', flex: 1 },
  exMeta: { fontSize: 13, color: '#888', marginLeft: 8 },
  muted: { fontSize: 14, color: '#999', fontStyle: 'italic' },
});
