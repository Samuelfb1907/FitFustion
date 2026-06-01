// Automatischer Trainingsplan (themed).
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import ExerciseDetail from '../components/ExerciseDetail';
import { WEEKDAYS, todayWeekday } from '../lib/weekdays';
import ErrorRetry from '../components/ErrorRetry';
import { errorMessage } from '../lib/errors';

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const DIFF_LABELS: Record<string, string> = { beginner: 'Anfänger', intermediate: 'Fortgeschritten', advanced: 'Profi' };
const ALLOWED_DIFF: Record<string, string[]> = {
  beginner: ['beginner'], some: ['beginner', 'intermediate'],
  advanced: ['beginner', 'intermediate', 'advanced'], pro: ['beginner', 'intermediate', 'advanced'],
};
const ALLOWED_EQUIP: Record<string, string[]> = {
  gym: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'none', 'other'],
  home_gym: ['dumbbell', 'bodyweight', 'none', 'other'],
  no_equipment: ['bodyweight', 'none'],
};
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

type PlanEx = { rowId: string; exId: string; name: string; difficulty: string; equipment: string; description: string | null; instructions: string | null; muscleKey: string | null; muscleName: string | null; sets: number; reps: number };
type DayView = { id: string; day_index: number; focus: string | null; exercises: PlanEx[] };
type Selected = { exercise: { id: string; name: string; difficulty: string; equipment: string; description: string | null; instructions: string | null }; muscleKey: string | null; muscleName: string | null };

export default function PlanScreen({ embedded }: { embedded?: boolean }) {
  const { session, profile } = useAuth();
  const userId = session?.user?.id;
  const c = useColors();
  const styles = makeStyles(c);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [planName, setPlanName] = useState<string | null>(null);
  const [days, setDays] = useState<DayView[]>([]);
  const [mode, setMode] = useState<'view' | 'create'>('create');
  const [selectedDays, setSelectedDays] = useState(3);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [doneToday, setDoneToday] = useState<Set<string>>(new Set());
  const [schedule, setSchedule] = useState<Record<number, string>>({}); // Wochentag -> plan_day_id
  const [editWeekday, setEditWeekday] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [addingToDay, setAddingToDay] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<{ id: string; name: string; difficulty: string; muscleName: string | null }[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);

  const allowedDiff = ALLOWED_DIFF[profile?.experience_level ?? 'beginner'] ?? ['beginner'];
  const allowedEquip = ALLOWED_EQUIP[profile?.training_environment ?? 'gym'] ?? ALLOWED_EQUIP.gym;

  useEffect(() => { loadPlan(); }, [userId]);

  async function loadPlan(silent = false) {
    if (!userId) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
    const { data: plan, error: planErr } = await supabase
      .from('workout_plans').select('id, name').eq('user_id', userId).eq('is_active', true)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (planErr) throw planErr;
    if (!plan) { setPlanName(null); setDays([]); setMode('create'); setLoadError(null); return; }
    const { data: dayRows } = await supabase.from('workout_plan_days').select('id, day_index, focus').eq('plan_id', plan.id).order('day_index');
    const dayIds = (dayRows ?? []).map((d: any) => d.id);
    let peRows: any[] = [];
    if (dayIds.length) {
      const { data } = await supabase
        .from('workout_plan_exercises')
        .select('id, plan_day_id, order_index, target_sets, target_reps, exercise_id, exercises(id, name, difficulty, equipment, description, instructions, primary_muscle_id)')
        .in('plan_day_id', dayIds).order('order_index');
      peRows = data ?? [];
    }
    const unwrap = (r: any) => (Array.isArray(r) ? r[0] : r);
    const { data: muscleRows } = await supabase.from('muscles').select('id, key, name_de');
    const muscById: Record<string, any> = {};
    (muscleRows ?? []).forEach((m: any) => { muscById[m.id] = m; });
    const assembled: DayView[] = (dayRows ?? []).map((d: any) => ({
      id: d.id, day_index: d.day_index, focus: d.focus,
      exercises: peRows.filter((pe: any) => pe.plan_day_id === d.id).map((pe: any) => {
        const ex = unwrap(pe.exercises) || {};
        const mu = muscById[ex.primary_muscle_id] || {};
        return { rowId: pe.id, exId: ex.id ?? pe.exercise_id, name: ex.name ?? '—', difficulty: ex.difficulty ?? '', equipment: ex.equipment ?? '', description: ex.description ?? null, instructions: ex.instructions ?? null, muscleKey: mu.key ?? null, muscleName: mu.name_de ?? null, sets: pe.target_sets ?? 3, reps: pe.target_reps ?? 10 };
      }),
    }));
    setPlanName(plan.name); setDays(assembled); setMode('view');
    const dayIdSet = new Set(assembled.map((d) => d.id));
    const { data: schedRows } = await supabase.from('plan_schedule').select('weekday, plan_day_id').eq('user_id', userId);
    const sched: Record<number, string> = {};
    (schedRows ?? []).forEach((r: any) => { if (dayIdSet.has(r.plan_day_id)) sched[r.weekday] = r.plan_day_id; });
    setSchedule(sched);
    await loadDoneToday();
    setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    loadPlan(true);
  }

  async function assignDay(weekday: number, dayId: string | null) {
    if (!userId) return;
    setEditWeekday(null);
    setSchedule((prev) => {
      const next = { ...prev };
      if (dayId) next[weekday] = dayId; else delete next[weekday];
      return next;
    });
    const { error } = dayId
      ? await supabase.from('plan_schedule').upsert({ user_id: userId, weekday, plan_day_id: dayId }, { onConflict: 'user_id,weekday' })
      : await supabase.from('plan_schedule').delete().eq('user_id', userId).eq('weekday', weekday);
    if (error) { Alert.alert('Nicht gespeichert', errorMessage(error)); loadPlan(true); }
  }

  async function removeExercise(dayId: string, rowId: string) {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, exercises: d.exercises.filter((e) => e.rowId !== rowId) } : d)));
    const { error } = await supabase.from('workout_plan_exercises').delete().eq('id', rowId);
    if (error) { Alert.alert('Nicht möglich', errorMessage(error)); loadPlan(true); }
  }

  async function updateSetsReps(dayId: string, rowId: string, sets: number, reps: number) {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, exercises: d.exercises.map((e) => (e.rowId === rowId ? { ...e, sets, reps } : e)) } : d)));
    const { error } = await supabase.from('workout_plan_exercises').update({ target_sets: sets, target_reps: reps }).eq('id', rowId);
    if (error) { Alert.alert('Nicht gespeichert', errorMessage(error)); loadPlan(true); }
  }

  async function openAddPicker(dayId: string) {
    setAddingToDay(dayId);
    setPickerSearch('');
    setPickerLoading(true);
    const { data: exRows } = await supabase.from('exercises').select('id, name, difficulty, primary_muscle_id').in('equipment', allowedEquip).in('difficulty', allowedDiff).order('name');
    const { data: muscleRows } = await supabase.from('muscles').select('id, name_de');
    const mById: Record<string, string> = {};
    (muscleRows ?? []).forEach((m: any) => { mById[m.id] = m.name_de; });
    setCandidates(((exRows ?? []) as any[]).map((e) => ({ id: e.id, name: e.name, difficulty: e.difficulty, muscleName: mById[e.primary_muscle_id] ?? null })));
    setPickerLoading(false);
  }

  async function addExercise(exId: string) {
    if (!userId || !addingToDay) return;
    const dayId = addingToDay;
    const day = days.find((d) => d.id === dayId);
    const order = day ? day.exercises.length : 0;
    setAddingToDay(null);
    const { data: row, error } = await supabase.from('workout_plan_exercises')
      .insert({ user_id: userId, plan_day_id: dayId, exercise_id: exId, target_sets: 3, target_reps: 10, order_index: order })
      .select('id').single();
    if (error || !row) { setError('Hinzufügen fehlgeschlagen.'); return; }
    // volle Uebungsdaten fuer die Anzeige holen + optimistisch einfuegen (kein voller Reload)
    const { data: ex } = await supabase.from('exercises').select('id, name, difficulty, equipment, description, instructions, primary_muscle_id').eq('id', exId).maybeSingle();
    let muscleKey: string | null = null, muscleName: string | null = null;
    if (ex?.primary_muscle_id) {
      const { data: mu } = await supabase.from('muscles').select('key, name_de').eq('id', ex.primary_muscle_id).maybeSingle();
      muscleKey = mu?.key ?? null; muscleName = mu?.name_de ?? null;
    }
    if (ex) {
      const newEx: PlanEx = { rowId: row.id, exId: ex.id, name: ex.name, difficulty: ex.difficulty, equipment: ex.equipment, description: ex.description, instructions: ex.instructions, muscleKey, muscleName, sets: 3, reps: 10 };
      setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, exercises: [...d.exercises, newEx] } : d)));
    }
  }

  async function loadDoneToday() {
    if (!userId) return;
    const { data } = await supabase.from('set_logs').select('exercise_id').eq('user_id', userId).gte('created_at', startOfTodayISO());
    setDoneToday(new Set((data ?? []).map((r: any) => r.exercise_id)));
  }

  async function generatePlan(n: number) {
    if (!userId) return;
    setGenerating(true); setError(null);
    try {
      await supabase.from('workout_plans').update({ is_active: false }).eq('user_id', userId).eq('is_active', true);
      await supabase.from('plan_schedule').delete().eq('user_id', userId); // Wochenplan zuruecksetzen
      setSchedule({});
      const { data: plan, error: pErr } = await supabase.from('workout_plans').insert({ user_id: userId, name: `Mein ${n}-Tage-Plan`, is_active: true }).select('id').single();
      if (pErr || !plan) throw pErr ?? new Error('Plan konnte nicht erstellt werden.');
      const template = SPLITS[n];
      const allKeys = Array.from(new Set(template.flatMap((d) => d.muscles)));
      const { data: muscleRows } = await supabase.from('muscles').select('id, key').in('key', allKeys);
      const idByKey: Record<string, string> = {};
      (muscleRows ?? []).forEach((m: any) => { idByKey[m.key] = m.id; });
      const muscleIds = Object.values(idByKey);
      // Equipment streng (Umgebung), Schwierigkeit bevorzugt – aber notfalls auch andere, damit kein Tag leer bleibt
      const { data: exRows } = await supabase.from('exercises').select('id, primary_muscle_id, difficulty').in('primary_muscle_id', muscleIds).in('equipment', allowedEquip);
      const exByMuscle: Record<string, any[]> = {};
      (exRows ?? []).forEach((e: any) => { if (!e.primary_muscle_id) return; if (!exByMuscle[e.primary_muscle_id]) exByMuscle[e.primary_muscle_id] = []; exByMuscle[e.primary_muscle_id].push(e); });
      const dayInsert = template.map((d, i) => ({ user_id: userId, plan_id: plan.id, day_index: i + 1, focus: d.focus }));
      const { data: insertedDays, error: dErr } = await supabase.from('workout_plan_days').insert(dayInsert).select('id, day_index');
      if (dErr || !insertedDays) throw dErr ?? new Error('Tage konnten nicht erstellt werden.');
      const peInsert: any[] = [];
      template.forEach((d, i) => {
        const day = insertedDays.find((x: any) => x.day_index === i + 1);
        if (!day) return;
        let order = 0;
        d.muscles.forEach((mk) => {
          const all = exByMuscle[idByKey[mk]] ?? [];
          const preferred = all.filter((e: any) => allowedDiff.includes(e.difficulty));
          const list = (preferred.length ? preferred : all).slice(0, 2);
          list.forEach((e: any) => { peInsert.push({ user_id: userId, plan_day_id: day.id, exercise_id: e.id, target_sets: 3, target_reps: 10, order_index: order++ }); });
        });
      });
      if (peInsert.length) { const { error: peErr } = await supabase.from('workout_plan_exercises').insert(peInsert); if (peErr) throw peErr; }
      await loadPlan();
    } catch (e: any) {
      setError(e?.message ?? 'Fehler bei der Plan-Erstellung.');
    } finally {
      setGenerating(false);
    }
  }

  // Vor dem Neu-Erstellen warnen, falls bereits ein Plan + Wochenzuordnung existiert
  function confirmGenerate(n: number) {
    if (!planName) { generatePlan(n); return; }
    Alert.alert('Neuen Plan erstellen?', 'Dein aktueller Plan und die Wochenzuordnung werden ersetzt. Fortfahren?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Ersetzen', style: 'destructive', onPress: () => generatePlan(n) },
    ]);
  }

  if (selected) {
    return (
      <ExerciseDetail
        exercise={selected.exercise}
        muscleKey={selected.muscleKey}
        muscleName={selected.muscleName}
        onBack={() => { setSelected(null); loadDoneToday(); }}
      />
    );
  }

  if (addingToDay) {
    const day = days.find((d) => d.id === addingToDay);
    const existing = new Set(day?.exercises.map((e) => e.exId) ?? []);
    const q = pickerSearch.trim().toLowerCase();
    const filtered = candidates.filter((e) => !existing.has(e.id) && (q ? e.name.toLowerCase().includes(q) : true));
    return (
      <View style={[styles.container, embedded && styles.embedded]}>
        <TouchableOpacity onPress={() => setAddingToDay(null)}><Text style={styles.back}>‹ Zurück</Text></TouchableOpacity>
        <Text style={styles.title}>Übung hinzufügen</Text>
        <Text style={styles.subtitle}>{day?.focus ?? ''}</Text>
        <TextInput style={styles.input} value={pickerSearch} onChangeText={setPickerSearch} placeholder="Suchen…" placeholderTextColor={c.textMuted} autoCorrect={false} />
        {pickerLoading ? (
          <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingTop: 10 }} keyboardShouldPersistTaps="handled">
            {filtered.map((e) => (
              <TouchableOpacity key={e.id} style={styles.pickRow} onPress={() => addExercise(e.id)} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exName}>{e.name}</Text>
                  <Text style={styles.exMeta}>{DIFF_LABELS[e.difficulty] ?? e.difficulty}{e.muscleName ? ` · ${e.muscleName}` : ''}</Text>
                </View>
                <Text style={styles.pickAdd}>+ Hinzufügen</Text>
              </TouchableOpacity>
            ))}
            {filtered.length === 0 && <Text style={styles.muted}>Keine weiteren passenden Übungen.</Text>}
          </ScrollView>
        )}
      </View>
    );
  }

  if (loading) {
    return (<View style={[styles.container, embedded && styles.embedded]}>{!embedded && <Text style={styles.title}>Trainingsplan</Text>}<ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} /></View>);
  }

  if (loadError) {
    return (
      <View style={[styles.container, embedded && styles.embedded]}>
        {!embedded && <Text style={styles.title}>Trainingsplan</Text>}
        <ErrorRetry message={loadError} onRetry={() => loadPlan()} embedded={embedded} />
      </View>
    );
  }

  if (mode === 'create') {
    return (
      <ScrollView style={[styles.container, embedded && styles.embedded]} contentContainerStyle={{ paddingBottom: 40 }}>
        {!embedded && <Text style={styles.title}>Trainingsplan erstellen</Text>}
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
        <TouchableOpacity style={[styles.primaryBtn, generating && { opacity: 0.6 }]} onPress={() => confirmGenerate(selectedDays)} disabled={generating}>
          {generating ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.primaryText}>Plan automatisch erstellen</Text>}
        </TouchableOpacity>
        {planName && !generating && (<TouchableOpacity onPress={() => setMode('view')}><Text style={styles.link}>Abbrechen</Text></TouchableOpacity>)}
        {error && <Text style={styles.error}>{error}</Text>}
        <Text style={styles.hint}>Der Plan wird automatisch an dein Level und deine Trainingsumgebung angepasst und gespeichert.</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, embedded && styles.embedded]}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
    >
      {!embedded && <Text style={styles.title}>Dein Trainingsplan</Text>}
      <Text style={styles.subtitle}>{planName}</Text>
      <View style={styles.topBtns}>
        <TouchableOpacity style={[styles.secondaryBtn, styles.topBtn]} onPress={() => { setEditMode(false); setMode('create'); }}>
          <Text style={styles.secondaryText}>Neuer Plan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryBtn, styles.topBtn, editMode && styles.editActive]} onPress={() => { setEditWeekday(null); setEditMode((v) => !v); }}>
          <Text style={[styles.secondaryText, editMode && { color: c.onPrimary }]}>{editMode ? '✓ Fertig' : '✏️ Bearbeiten'}</Text>
        </TouchableOpacity>
      </View>
      {!editMode && (
      <View style={styles.weekCard}>
        <Text style={styles.weekTitle}>📅 Wochenplan</Text>
        <Text style={styles.weekHint}>Tippe einen Wochentag, um ihm einen Trainingstag (oder Ruhetag) zuzuordnen.</Text>
        {WEEKDAYS.map((wd, i) => {
          const dayId = schedule[i];
          const focus = dayId ? (days.find((d) => d.id === dayId)?.focus ?? 'Training') : null;
          const isToday = i === todayWeekday();
          return (
            <View key={i}>
              <TouchableOpacity style={[styles.weekRow, isToday && styles.weekRowToday]} onPress={() => setEditWeekday(editWeekday === i ? null : i)} activeOpacity={0.7}>
                <Text style={[styles.weekDay, isToday && { color: c.primary, fontWeight: '700' }]}>{wd}{isToday ? '  · heute' : ''}</Text>
                <Text style={[styles.weekFocus, !focus && styles.weekRest]} numberOfLines={1}>{focus ?? 'Ruhetag'}</Text>
              </TouchableOpacity>
              {editWeekday === i && (
                <View style={styles.weekPicker}>
                  {days.map((d) => (
                    <TouchableOpacity key={d.id} style={[styles.weekOpt, dayId === d.id && styles.weekOptActive]} onPress={() => assignDay(i, d.id)} activeOpacity={0.7}>
                      <Text style={[styles.weekOptText, dayId === d.id && styles.weekOptTextActive]}>Tag {d.day_index}: {d.focus}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={[styles.weekOpt, !dayId && styles.weekOptActive]} onPress={() => assignDay(i, null)} activeOpacity={0.7}>
                    <Text style={[styles.weekOptText, !dayId && styles.weekOptTextActive]}>😌 Ruhetag</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </View>
      )}

      <Text style={styles.tapHint}>{editMode ? 'Sätze/Wdh anpassen, Übungen entfernen 🗑 oder unten hinzufügen.' : 'Tippe eine Übung an für Animation, Anleitung & Mitschreiben.'}</Text>
      {days.map((d) => (
        <View key={d.id} style={styles.dayCard}>
          <Text style={styles.dayTitle}>Tag {d.day_index}</Text>
          <Text style={styles.dayFocus}>{d.focus}</Text>
          {d.exercises.length === 0 && !editMode ? (
            <Text style={styles.muted}>Keine passenden Übungen – ggf. Umgebung/Level im Profil anpassen.</Text>
          ) : (
            d.exercises.map((ex) =>
              editMode ? (
                <View key={ex.rowId} style={styles.exEditRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.exName} numberOfLines={1}>{ex.name}</Text>
                    <View style={styles.editControls}>
                      <Stepper label="Sätze" value={ex.sets} onDec={() => updateSetsReps(d.id, ex.rowId, Math.max(1, ex.sets - 1), ex.reps)} onInc={() => updateSetsReps(d.id, ex.rowId, Math.min(10, ex.sets + 1), ex.reps)} styles={styles} />
                      <Stepper label="Wdh" value={ex.reps} onDec={() => updateSetsReps(d.id, ex.rowId, ex.sets, Math.max(1, ex.reps - 1))} onInc={() => updateSetsReps(d.id, ex.rowId, ex.sets, Math.min(50, ex.reps + 1))} styles={styles} />
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => removeExercise(d.id, ex.rowId)} style={styles.removeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.removeText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity key={ex.rowId} style={styles.exItem} activeOpacity={0.7}
                  onPress={() => setSelected({ exercise: { id: ex.exId, name: ex.name, difficulty: ex.difficulty, equipment: ex.equipment, description: ex.description, instructions: ex.instructions }, muscleKey: ex.muscleKey, muscleName: ex.muscleName })}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.exName, doneToday.has(ex.exId) && { color: c.success, fontWeight: '700' }]}>{doneToday.has(ex.exId) ? '✓ ' : ''}{ex.name}</Text>
                    <Text style={styles.exMeta}>{ex.sets} × {ex.reps} · {DIFF_LABELS[ex.difficulty] ?? ex.difficulty}{ex.muscleName ? ` · ${ex.muscleName}` : ''}</Text>
                  </View>
                  <Text style={styles.chev}>›</Text>
                </TouchableOpacity>
              )
            )
          )}
          {editMode && (
            <TouchableOpacity style={styles.addExBtn} onPress={() => openAddPicker(d.id)} activeOpacity={0.85}>
              <Text style={styles.addExText}>+ Übung hinzufügen</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function Stepper({ label, value, onDec, onInc, styles }: { label: string; value: number; onDec: () => void; onInc: () => void; styles: any }) {
  return (
    <View style={styles.stepperWrap}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity style={styles.stepBtn} onPress={onDec} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}><Text style={styles.stepBtnText}>−</Text></TouchableOpacity>
        <Text style={styles.stepVal}>{value}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={onInc} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 60, paddingHorizontal: 20 },
    embedded: { paddingTop: 8, paddingHorizontal: 0, backgroundColor: 'transparent' },
    title: { fontSize: 26, fontWeight: 'bold', color: c.heading },
    subtitle: { fontSize: 15, color: c.textMuted, marginTop: 2, marginBottom: 16 },
    back: { color: c.primary, fontSize: 15, fontWeight: '600', marginBottom: 10 },
    dayPicker: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    dayOpt: { width: 52, height: 52, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card },
    dayOptActive: { backgroundColor: c.primary, borderColor: c.primary },
    dayOptText: { fontSize: 20, fontWeight: '700', color: c.heading },
    dayOptTextActive: { color: c.onPrimary },
    primaryBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
    primaryText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
    secondaryBtn: { borderWidth: 1, borderColor: c.border, backgroundColor: c.card, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 16 },
    secondaryText: { color: c.primary, fontSize: 15, fontWeight: '600' },
    link: { color: c.primary, textAlign: 'center', marginTop: 14, fontSize: 14 },
    hint: { fontSize: 13, color: c.textMuted, marginTop: 20, lineHeight: 18 },
    error: { color: c.danger, fontSize: 14, marginTop: 14, textAlign: 'center' },
    dayCard: { backgroundColor: c.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    dayTitle: { fontSize: 13, color: c.textMuted, fontWeight: '700', letterSpacing: 0.5 },
    dayFocus: { fontSize: 18, fontWeight: '700', color: c.heading, marginTop: 2, marginBottom: 10 },
    exItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
    exName: { fontSize: 15, color: c.text },
    exMeta: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    chev: { fontSize: 22, color: c.textMuted, marginLeft: 8 },
    tapHint: { fontSize: 12, color: c.textMuted, marginTop: -6, marginBottom: 12 },
    muted: { fontSize: 14, color: c.textMuted, fontStyle: 'italic' },
    weekCard: { backgroundColor: c.card, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    weekTitle: { fontSize: 16, fontWeight: '700', color: c.heading },
    weekHint: { fontSize: 12, color: c.textMuted, marginTop: 2, marginBottom: 8, lineHeight: 16 },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
    weekRowToday: { backgroundColor: c.inputBg, borderRadius: 8, paddingHorizontal: 8, marginHorizontal: -8 },
    weekDay: { fontSize: 15, color: c.text },
    weekFocus: { fontSize: 14, color: c.heading, fontWeight: '600', flexShrink: 1, marginLeft: 12, textAlign: 'right' },
    weekRest: { color: c.textMuted, fontWeight: '400', fontStyle: 'italic' },
    weekPicker: { paddingVertical: 6, gap: 6 },
    weekOpt: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.inputBg },
    weekOptActive: { backgroundColor: c.primary, borderColor: c.primary },
    weekOptText: { fontSize: 14, color: c.text, fontWeight: '600' },
    weekOptTextActive: { color: c.onPrimary },
    topBtns: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    topBtn: { flex: 1, marginBottom: 0 },
    editActive: { backgroundColor: c.primary, borderColor: c.primary },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: c.inputBg, color: c.text },
    pickRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    pickAdd: { fontSize: 13, color: c.primary, fontWeight: '700', marginLeft: 8 },
    exEditRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
    editControls: { flexDirection: 'row', gap: 16, marginTop: 8 },
    stepperWrap: { alignItems: 'flex-start' },
    stepperLabel: { fontSize: 11, color: c.textMuted, marginBottom: 4, fontWeight: '600' },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', backgroundColor: c.inputBg },
    stepBtnText: { fontSize: 18, color: c.primary, fontWeight: '700' },
    stepVal: { fontSize: 15, color: c.heading, fontWeight: '700', minWidth: 24, textAlign: 'center' },
    removeBtn: { padding: 8 },
    removeText: { fontSize: 18 },
    addExBtn: { marginTop: 10, borderWidth: 1, borderColor: c.primary, borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: c.inputBg },
    addExText: { color: c.primary, fontSize: 14, fontWeight: '700' },
  });
}
