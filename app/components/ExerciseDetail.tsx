// Übungsdetail (themed) mit "Training mitschreiben": Sätze (Wdh + Gewicht) speichern.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import ExerciseFigure from './ExerciseFigure';
import BackButton from './BackButton';
import ExerciseGif, { GIF_AVAILABLE } from './ExerciseGif';
import RestTimer from './RestTimer';
import GlassFill from './GlassFill';
import { exerciseGifId } from '../lib/exerciseMedia';
import { startOfTodayISO } from '../lib/date';
import { TAB_BAR_SPACE } from '../lib/layout';
import { DIFF_LABELS, EQUIP_LABELS } from '../lib/training';
import { registerGoodMoment } from '../lib/reviewPrompt';
import { hTap, hSuccess } from '../lib/haptics';
import Confetti from './Confetti';
import { logActivity } from '../lib/activity';
import { checkProgression, ProgressionResult } from '../lib/progression';

type Exercise = { id: string; name: string; difficulty: string; equipment: string; description: string | null; instructions: string | null };
type SetLog = { id: string; set_index: number; reps: number | null; weight_kg: number | null };

// Konstanten -> lib/training.ts, startOfTodayISO -> lib/date.ts

// "1. ... 2. ... 3. ..." -> ["...", "...", "..."]
function parseSteps(instr: string | null): string[] {
  if (!instr) return [];
  const parts = instr.split(/\s*\d+\.\s*/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [instr.trim()];
}

// allgemein gueltige, hilfreiche Technik-Tipps (nach Geraet & Level)
// Hantelscheiben-Rechner: zerlegt das Gewicht pro Seite in Standard-Scheiben (Olympia-Stange 20 kg).
const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
function platesPerSide(total: number, bar = 20): { plate: number; count: number }[] | null {
  if (!isFinite(total) || total < bar) return null;
  let perSide = (total - bar) / 2;
  const out: { plate: number; count: number }[] = [];
  for (const p of PLATES) {
    const n = Math.floor(perSide / p + 1e-9);
    if (n > 0) { out.push({ plate: p, count: n }); perSide = Math.round((perSide - n * p) * 100) / 100; }
  }
  return out;
}

// Progressive Overload: aus dem letzten Satz einen konkreten naechsten Zielwert ableiten.
function nextGoal(
  last: { reps: number | null; weight: number | null } | null,
  equipment: string,
): { reps: number; weight: number | null } | null {
  if (!last || last.reps == null) return null;
  // Mit Gewicht: kleines, geraeteabhaengiges Increment auf das letzte Gewicht.
  if (last.weight != null && last.weight > 0) {
    const step = equipment === 'barbell' ? 2.5 : 1;
    const w = Math.round((last.weight + step) * 2) / 2; // auf 0,5 kg runden
    return { reps: last.reps, weight: w };
  }
  // Ohne Gewicht (Bodyweight o. Ae.): eine Wiederholung mehr.
  return { reps: last.reps + 1, weight: null };
}

function tipsFor(equipment: string, difficulty: string): string[] {
  const t = [
    'Bewegung langsam & kontrolliert ausführen – kein Schwung.',
    'Atmung: beim Anstrengen ausatmen, beim Zurückführen einatmen.',
  ];
  if (equipment === 'barbell' || equipment === 'dumbbell') t.push('Rumpf anspannen, Rücken gerade halten.');
  else if (equipment === 'bodyweight' || equipment === 'none') t.push('Körper in einer Linie halten, Bauch anspannen.');
  else if (equipment === 'machine') t.push('Sitz & Polster passend einstellen, damit die Gelenke sauber geführt werden.');
  else if (equipment === 'cable') t.push('Spannung über die ganze Bewegung halten.');
  t.push(difficulty === 'beginner' ? 'Erst die Technik mit wenig Gewicht üben, dann steigern.' : 'Volle Bewegungsamplitude nutzen und vorher kurz aufwärmen.');
  return t.slice(0, 4);
}

export default function ExerciseDetail({ exercise, onBack, muscleKey, muscleName, targetSets, targetReps, targetWeight, planExerciseId }: { exercise: Exercise; onBack: () => void; muscleKey?: string | null; muscleName?: string | null; targetSets?: number; targetReps?: number; targetWeight?: number | null; planExerciseId?: string }) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const steps = parseSteps(exercise.instructions);
  const tips = tipsFor(exercise.equipment, exercise.difficulty);
  const gifId = exerciseGifId(exercise.name);
  const hasGif = GIF_AVAILABLE;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0); // hochzaehlen -> Konfetti-Regen (neuer Rekord)
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sets, setSets] = useState<SetLog[]>([]);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [ending, setEnding] = useState(false);
  const [ended, setEnded] = useState(false);
  const [gifFailed, setGifFailed] = useState(false);
  const [restSignal, setRestSignal] = useState(0);
  const [progResult, setProgResult] = useState<ProgressionResult | null>(null);
  const savingRef = useRef(false);
  const bestWeightRef = useRef<number | null>(null);
  const [lastEntry, setLastEntry] = useState<{ reps: number | null; weight: number | null } | null>(null);
  const [best1RM, setBest1RM] = useState<number | null>(null);
  const goal = useMemo(() => nextGoal(lastEntry, exercise.equipment), [lastEntry, exercise.equipment]);
  // Hantelscheiben-Rechner: nur bei Langhantel, live aus dem Gewichts-Feld.
  const plateW = Number(weight.replace(',', '.'));
  const plates = exercise.equipment === 'barbell' && weight.trim() !== '' && isFinite(plateW) ? platesPerSide(plateW) : null;

  useEffect(() => {
    let active = true;
    async function init() {
      if (!userId) { setLoading(false); return; }
      setLoading(true);
      const { data: existing } = await supabase
        .from('workout_sessions')
        .select('id')
        .eq('user_id', userId)
        .is('ended_at', null)
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

  // "Letztes Mal"-Werte + persoenlichen Rekord (Gewicht) fuer diese Uebung laden (sessionuebergreifend).
  useEffect(() => {
    let active = true;
    async function loadHistory() {
      if (!userId) return;
      const [lastRes, bestRes] = await Promise.all([
        supabase.from('set_logs').select('reps, weight_kg').eq('user_id', userId).eq('exercise_id', exercise.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('set_logs').select('reps, weight_kg').eq('user_id', userId).eq('exercise_id', exercise.id).not('weight_kg', 'is', null).order('weight_kg', { ascending: false }).limit(50),
      ]);
      if (!active) return;
      const bestRows = (bestRes.data ?? []) as { reps: number | null; weight_kg: number | null }[];
      bestWeightRef.current = bestRows[0]?.weight_kg ?? null;
      // Geschaetztes 1RM (Epley-Formel): groesster Wert ueber die schwersten Saetze. weight * (1 + reps/30).
      let best1 = 0;
      for (const r of bestRows) {
        const w = Number(r.weight_kg) || 0; const reps = Number(r.reps) || 0;
        if (w > 0 && reps > 0) best1 = Math.max(best1, Math.round(w * (1 + reps / 30)));
      }
      setBest1RM(best1 > 0 ? best1 : null);
      const last = lastRes.data;
      if (last) {
        setLastEntry({ reps: last.reps, weight: last.weight_kg });
        // Vorbefuellen, aber nur wenn der Nutzer noch nichts eingegeben hat.
        const lr = last.reps;
        const lw = last.weight_kg;
        if (lr != null) setReps((prev) => (prev === '' ? String(lr) : prev));
        if (lw != null) setWeight((prev) => (prev === '' ? String(lw) : prev));
      }
    }
    loadHistory();
    return () => { active = false; };
  }, [userId, exercise.id]);

  useEffect(() => { setGifFailed(false); }, [exercise.id]);

  useEffect(() => {
    if (targetReps != null && targetReps > 0) setReps((prev) => (prev === '' ? String(targetReps) : prev));
    if (targetWeight != null && targetWeight > 0) setWeight((prev) => (prev === '' ? String(targetWeight) : prev));
  }, [exercise.id, targetReps, targetWeight]);

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
    if (!r || r <= 0) { setError(t('exercise.errReps')); return; }
    let w: number | null = null;
    if (weight.trim()) {
      w = Number(weight.replace(',', '.'));
      if (!isFinite(w) || w < 0 || w > 1000) { setError(t('exercise.errWeight')); return; }
    }
    if (!userId) return;
    if (savingRef.current) return; // synchroner Lock gegen schnellen Doppel-Tipp
    savingRef.current = true;
    setSaving(true);
    try {
      let sid = sessionId;
      if (!sid) {
        const { data: created, error: cErr } = await supabase.from('workout_sessions').insert({ user_id: userId }).select('id').single();
        if (cErr || !created) { setError(cErr?.message ?? t('exercise.errSession')); return; }
        sid = created.id;
        setSessionId(sid);
      }
      if (!sid) return;
      const { error: iErr } = await supabase.from('set_logs').insert({
        user_id: userId, session_id: sid, exercise_id: exercise.id, set_index: (sets.length ? Math.max(...sets.map((s) => s.set_index)) : 0) + 1, reps: r, weight_kg: w,
      });
      if (iErr) setError(iErr.message);
      else {
        await refreshSets(sid);
        setEnded(false);
        setRestSignal((n) => n + 1);
        setLastEntry({ reps: r, weight: w });
        // Letzten Satz als Vorbefuellung behalten -> schnelleres Mitschreiben der Folgesaetze.
        setReps(String(r));
        hTap(); // spuerbares Feedback: Satz gespeichert
        // Neuer persoenlicher Rekord (Gewicht uebertroffen) = starker Positiv-Moment fuer die Bewertungs-Abfrage.
        if (w != null) {
          const prevBest = bestWeightRef.current;
          if (prevBest != null && w > prevBest) { registerGoodMoment(); hSuccess(); setConfettiKey((k) => k + 1); logActivity('record', exercise.name); }
          if (prevBest == null || w > prevBest) bestWeightRef.current = w;
        }
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function deleteSet(id: string) {
    Alert.alert(t('exercise.deleteTitle'), t('exercise.deleteMsg'), [
      { text: t('exercise.cancel'), style: 'cancel' },
      { text: t('exercise.delete'), style: 'destructive', onPress: () => doDeleteSet(id) },
    ]);
  }
  async function doDeleteSet(id: string) {
    if (!sessionId) return;
    await supabase.from('set_logs').delete().eq('id', id);
    await refreshSets(sessionId);
  }

  async function endTraining() {
    if (!sessionId) return;
    const hadSets = sets.length > 0;
    setEnding(true);
    setError(null);
    const { error: eErr } = await supabase
      .from('workout_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId);
    setEnding(false);
    if (eErr) { setError(eErr.message); return; }
    if (hadSets && planExerciseId && targetSets != null && targetReps != null) {
      const setsData = sets.map((s) => ({ reps: s.reps, weight_kg: s.weight_kg }));
      const pr = await checkProgression(planExerciseId, exercise.equipment, setsData, targetSets, targetReps, targetWeight ?? null);
      if (pr) { setProgResult(pr); if (pr.type === 'weight_up' || pr.type === 'reps_up') { hSuccess(); setConfettiKey((k) => k + 1); } }
    }
    setSessionId(null);
    setSets([]);
    setReps('');
    setEnded(true);
    if (hadSets) { registerGoodMoment(); hSuccess(); logActivity('trained'); }
  }

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + 80 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <BackButton onPress={onBack} c={c} />
      <Text style={styles.title}>{exercise.name}</Text>
      <View style={styles.badges}>
        <Text style={styles.badge}>{DIFF_LABELS[exercise.difficulty] ?? exercise.difficulty}</Text>
        <Text style={styles.badge}>{EQUIP_LABELS[exercise.equipment] ?? exercise.equipment}</Text>
      </View>
      {gifId && hasGif && !gifFailed ? (
        <View style={styles.illusCard}>
          <GlassFill radius={16} />
          <ExerciseGif exerciseId={gifId} c={c} onFail={() => setGifFailed(true)} />
          <Text style={styles.illusCaption}>{t('exercise.howTo')}{muscleName ? t('exercise.targetMuscleSuffix', { name: muscleName }) : ''}</Text>
        </View>
      ) : muscleKey ? (
        <View style={styles.illusCard}>
          <GlassFill radius={16} />
          <ExerciseFigure muscleKey={muscleKey} c={c} width={150} />
          <Text style={styles.illusCaption}>{t('exercise.targetMuscle', { name: muscleName ?? '—' })}</Text>
        </View>
      ) : null}

      {exercise.description ? <Text style={styles.desc}>{exercise.description}</Text> : null}

      {steps.length > 0 ? (
        <>
          <Text style={styles.h2}>{t('exercise.howToHeading')}</Text>
          {steps.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
              <Text style={styles.stepText}>{s}</Text>
            </View>
          ))}
        </>
      ) : null}

      <Text style={[styles.h2, { marginTop: 18 }]}>{t('exercise.tipsHeading')}</Text>
      {tips.map((tip, i) => (
        <View key={i} style={styles.tipRow}>
          <Text style={styles.tipDot}>•</Text>
          <Text style={styles.tipText}>{tip}</Text>
        </View>
      ))}

      <View style={styles.logCard}>
        <GlassFill radius={16} />
        <Text style={styles.h2}>{t('exercise.logHeading')}</Text>
        {targetSets != null && targetReps != null && (
          <Text style={styles.targetHint}>{targetWeight != null ? t('exercise.planTargetWeight', { sets: targetSets, reps: targetReps, kg: targetWeight }) : t('exercise.planTarget', { sets: targetSets, reps: targetReps })}</Text>
        )}
        {loading ? (
          <ActivityIndicator color={c.primary} style={{ marginVertical: 12 }} />
        ) : (
          <>
            {sets.length > 0 ? (
              <View style={styles.setList}>
                {sets.map((s) => (
                  <View key={s.id} style={styles.setRow}>
                    <Text style={styles.setIdx}>{t('exercise.setIndex', { n: s.set_index })}</Text>
                    <View style={styles.setRight}>
                      <Text style={styles.setVal}>{t('exercise.reps', { n: s.reps ?? 0 })}{s.weight_kg ? t('exercise.weightSuffix', { kg: s.weight_kg }) : ''}</Text>
                      <TouchableOpacity onPress={() => deleteSet(s.id)} style={styles.setDel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('exercise.deleteSetA11y', { n: s.set_index })}>
                        <Text style={styles.setDelText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.hint}>{t('exercise.noSets')}</Text>
            )}
            {best1RM != null && best1RM > 0 && (
              <Text style={styles.oneRm}>{t('exercise.oneRm', { kg: best1RM })}</Text>
            )}
            {lastEntry && lastEntry.reps != null && (
              <Text style={styles.hint}>{lastEntry.weight != null ? t('exercise.lastTime', { weight: lastEntry.weight, reps: lastEntry.reps }) : t('exercise.lastTimeNoWeight', { reps: lastEntry.reps })}</Text>
            )}
            {goal && (
              <TouchableOpacity
                style={styles.coachChip}
                onPress={() => { setReps(String(goal.reps)); setWeight(goal.weight != null ? String(goal.weight) : ''); }}
                accessibilityRole="button"
                accessibilityLabel={goal.weight != null ? t('exercise.coachGoalA11y', { weight: goal.weight, reps: goal.reps }) : t('exercise.coachGoalRepsA11y', { reps: goal.reps })}
              >
                <Text style={styles.coachChipText}>{goal.weight != null ? t('exercise.coachGoal', { weight: goal.weight, reps: goal.reps }) : t('exercise.coachGoalReps', { reps: goal.reps })}</Text>
              </TouchableOpacity>
            )}
            <View style={styles.inputRow}>
              <View style={styles.inputCol}>
                <Text style={styles.inputLabel}>{t('exercise.repsLabel')}</Text>
                <TextInput style={styles.input} value={reps} onChangeText={setReps} placeholder={t('exercise.repsPlaceholder')} placeholderTextColor={c.textMuted} keyboardType="numeric" />
              </View>
              <View style={styles.inputCol}>
                <Text style={styles.inputLabel}>{t('exercise.weightLabel')}</Text>
                <TextInput style={styles.input} value={weight} onChangeText={setWeight} placeholder={t('exercise.weightPlaceholder')} placeholderTextColor={c.textMuted} keyboardType="numeric" />
              </View>
            </View>
            {plates !== null && (
              <Text style={styles.plates}>{plates.length === 0 ? t('exercise.platesBarOnly') : t('exercise.platesLabel', { plates: plates.map((p) => `${p.count}×${p.plate}`).join(' · ') })}</Text>
            )}
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={saveSet} disabled={saving}>
              {saving ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.saveText}>{t('exercise.saveSet')}</Text>}
            </TouchableOpacity>
            {sets.length > 0 && <Text style={styles.doneHint}>{t(sets.length === 1 ? 'exercise.doneHintOne' : 'exercise.doneHintMany', { n: sets.length })}</Text>}
            {error && <Text style={styles.error}>{error}</Text>}
            <RestTimer c={c} autoStartSignal={restSignal} />
            {sessionId && (
              <TouchableOpacity style={styles.endBtn} onPress={endTraining} disabled={ending || saving}>
                {ending ? <ActivityIndicator color={c.success} /> : <Text style={styles.endText}>{t('exercise.endTraining')}</Text>}
              </TouchableOpacity>
            )}
            {ended && (
              <Text style={styles.endedHint}>{t('exercise.endedHint')}</Text>
            )}
            {progResult && progResult.type === 'weight_up' && progResult.newWeight != null && (
              <Text style={styles.progHint}>{t('exercise.progWeight', { kg: progResult.newWeight })}</Text>
            )}
            {progResult && progResult.type === 'reps_up' && (
              <Text style={styles.progHint}>{t('exercise.progReps', { reps: progResult.newReps })}</Text>
            )}
            {progResult && progResult.type === 'seeded' && progResult.newWeight != null && (
              <Text style={styles.progHint}>{t('exercise.progSeeded', { kg: progResult.newWeight })}</Text>
            )}
          </>
        )}
      </View>
    </ScrollView>
      <Confetti fireKey={confettiKey} />
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 60, paddingHorizontal: 20 },
    back: { color: c.primary, fontSize: 15, fontWeight: '600', marginBottom: 10 },
    title: { fontSize: 26, fontWeight: 'bold', color: c.heading },
    badges: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 16 },
    badge: { backgroundColor: c.inputBg, color: c.primary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, fontSize: 13, overflow: 'hidden' },
    desc: { fontSize: 15, color: c.text, lineHeight: 22, marginBottom: 16 },
    h2: { fontSize: 17, fontWeight: '700', color: c.heading, marginBottom: 8 },
    illusCard: { backgroundColor: c.card, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 14, alignItems: 'center', marginBottom: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    illusCaption: { fontSize: 13, color: c.textMuted, marginTop: 8, fontWeight: '600' },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
    stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1 },
    stepNumText: { color: c.onPrimary, fontSize: 13, fontWeight: '700' },
    stepText: { flex: 1, fontSize: 15, color: c.text, lineHeight: 22 },
    tipRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    tipDot: { color: c.accent, fontSize: 16, marginRight: 8, lineHeight: 20 },
    tipText: { flex: 1, fontSize: 14, color: c.textMuted, lineHeight: 20 },
    logCard: { backgroundColor: c.card, borderRadius: 16, padding: 18, marginTop: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    hint: { fontSize: 14, color: c.textMuted, marginBottom: 12 },
    targetHint: { fontSize: 13, color: c.primary, fontWeight: '700', marginBottom: 12 },
    coachChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.primary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 12 },
    coachChipText: { fontSize: 13, color: c.primary, fontWeight: '700' },
    plates: { fontSize: 13, color: c.textMuted, marginTop: -4, marginBottom: 12 },
    oneRm: { fontSize: 13, color: c.primary, fontWeight: '700', marginBottom: 8 },
    setList: { marginBottom: 12 },
    setRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth },
    setIdx: { fontSize: 15, color: c.textMuted, fontWeight: '600' },
    setRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    setVal: { fontSize: 15, color: c.text, fontWeight: '600' },
    setDel: { padding: 2 },
    setDelText: { fontSize: 14, color: c.textMuted },
    inputRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
    inputCol: { flex: 1 },
    inputLabel: { fontSize: 13, color: c.text, fontWeight: '600', marginBottom: 6 },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: c.inputBg, color: c.text },
    saveBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
    saveText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
    doneHint: { fontSize: 13, color: c.success, fontWeight: '600', textAlign: 'center', marginTop: 12 },
    error: { color: c.danger, fontSize: 14, marginTop: 12, textAlign: 'center' },
    endBtn: { marginTop: 14, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: c.success },
    endText: { color: c.success, fontSize: 15, fontWeight: '700' },
    endedHint: { fontSize: 13, color: c.success, textAlign: 'center', marginTop: 12, lineHeight: 19 },
    progHint: { fontSize: 14, color: c.primary, fontWeight: '700', textAlign: 'center', marginTop: 10, lineHeight: 20 },
  });
}
