// Übungsdetail (themed) mit "Training mitschreiben": Sätze (Wdh + Gewicht) speichern.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import ExerciseFigure from './ExerciseFigure';
import BackButton from './BackButton';
import ExerciseGif, { GIF_AVAILABLE } from './ExerciseGif';
import RestTimer from './RestTimer';
import GlassFill from './GlassFill';
import { exerciseGifId } from '../lib/exerciseMedia';
import { startOfTodayISO } from '../lib/date';
import { DIFF_LABELS, EQUIP_LABELS } from '../lib/training';

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

export default function ExerciseDetail({ exercise, onBack, muscleKey, muscleName }: { exercise: Exercise; onBack: () => void; muscleKey?: string | null; muscleName?: string | null }) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const steps = parseSteps(exercise.instructions);
  const tips = tipsFor(exercise.equipment, exercise.difficulty);
  const gifId = exerciseGifId(exercise.name);
  const hasGif = GIF_AVAILABLE;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sets, setSets] = useState<SetLog[]>([]);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [ending, setEnding] = useState(false);
  const [ended, setEnded] = useState(false);
  const [gifFailed, setGifFailed] = useState(false);
  const [restSignal, setRestSignal] = useState(0);
  const savingRef = useRef(false);

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

  useEffect(() => { setGifFailed(false); }, [exercise.id]);

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
    if (!r || r <= 0) { setError('Bitte gültige Wiederholungen eingeben.'); return; }
    const w = weight.trim() ? Number(weight.replace(',', '.')) : null;
    if (!userId) return;
    if (savingRef.current) return; // synchroner Lock gegen schnellen Doppel-Tipp
    savingRef.current = true;
    setSaving(true);
    try {
      let sid = sessionId;
      if (!sid) {
        const { data: created, error: cErr } = await supabase.from('workout_sessions').insert({ user_id: userId }).select('id').single();
        if (cErr || !created) { setError(cErr?.message ?? 'Session konnte nicht angelegt werden.'); return; }
        sid = created.id;
        setSessionId(sid);
      }
      if (!sid) return;
      const { error: iErr } = await supabase.from('set_logs').insert({
        user_id: userId, session_id: sid, exercise_id: exercise.id, set_index: sets.length + 1, reps: r, weight_kg: w,
      });
      if (iErr) setError(iErr.message);
      else { await refreshSets(sid); setReps(''); setEnded(false); setRestSignal((n) => n + 1); }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function deleteSet(id: string) {
    Alert.alert('Satz löschen?', 'Diesen Satz wirklich entfernen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => doDeleteSet(id) },
    ]);
  }
  async function doDeleteSet(id: string) {
    if (!sessionId) return;
    await supabase.from('set_logs').delete().eq('id', id);
    await refreshSets(sessionId);
  }

  async function endTraining() {
    if (!sessionId) return;
    setEnding(true);
    setError(null);
    const { error: eErr } = await supabase
      .from('workout_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId);
    setEnding(false);
    if (eErr) { setError(eErr.message); return; }
    setSessionId(null);
    setSets([]);
    setReps('');
    setEnded(true);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <BackButton onPress={onBack} c={c} />
      <Text style={styles.title}>{exercise.name}</Text>
      <View style={styles.badges}>
        <Text style={styles.badge}>{DIFF_LABELS[exercise.difficulty] ?? exercise.difficulty}</Text>
        <Text style={styles.badge}>{EQUIP_LABELS[exercise.equipment] ?? exercise.equipment}</Text>
      </View>
      {(gifId && hasGif && !gifFailed) || muscleKey ? (
        <View style={styles.illusWrap}>
          {/* Coach-Avocado: Koerper lugt ueber die Kartenkante (hinter der Karte) ... */}
          <View style={styles.coachBodyClip} pointerEvents="none">
            <Image source={require('../assets/avocado-point.png')} style={styles.coachImgBody} resizeMode="contain" />
          </View>
          {gifId && hasGif && !gifFailed ? (
            <View style={styles.illusCard}>
              <GlassFill radius={16} />
              <ExerciseGif exerciseId={gifId} c={c} onFail={() => setGifFailed(true)} />
              <Text style={styles.illusCaption}>So wird's gemacht{muscleName ? ` · Zielmuskel: ${muscleName}` : ''}</Text>
            </View>
          ) : muscleKey ? (
            <View style={styles.illusCard}>
              <GlassFill radius={16} />
              <ExerciseFigure muscleKey={muscleKey} c={c} width={150} />
              <Text style={styles.illusCaption}>Zielmuskel: {muscleName ?? '—'}</Text>
            </View>
          ) : null}
          {/* ... und die Haende liegen VORNE auf der Karte */}
          <View style={styles.coachArmsClip} pointerEvents="none">
            <Image source={require('../assets/avocado-arms.png')} style={styles.coachImgArms} resizeMode="contain" />
          </View>
        </View>
      ) : null}

      {exercise.description ? <Text style={styles.desc}>{exercise.description}</Text> : null}

      {steps.length > 0 ? (
        <>
          <Text style={styles.h2}>Ausführung</Text>
          {steps.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
              <Text style={styles.stepText}>{s}</Text>
            </View>
          ))}
        </>
      ) : null}

      <Text style={[styles.h2, { marginTop: 18 }]}>Tipps</Text>
      {tips.map((t, i) => (
        <View key={i} style={styles.tipRow}>
          <Text style={styles.tipDot}>•</Text>
          <Text style={styles.tipText}>{t}</Text>
        </View>
      ))}

      <View style={styles.logCard}>
        <GlassFill radius={16} />
        <Text style={styles.h2}>Training mitschreiben</Text>
        {loading ? (
          <ActivityIndicator color={c.primary} style={{ marginVertical: 12 }} />
        ) : (
          <>
            {sets.length > 0 ? (
              <View style={styles.setList}>
                {sets.map((s) => (
                  <View key={s.id} style={styles.setRow}>
                    <Text style={styles.setIdx}>Satz {s.set_index}</Text>
                    <View style={styles.setRight}>
                      <Text style={styles.setVal}>{s.reps} Wdh{s.weight_kg ? ` × ${s.weight_kg} kg` : ''}</Text>
                      <TouchableOpacity onPress={() => deleteSet(s.id)} style={styles.setDel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={`Satz ${s.set_index} löschen`}>
                        <Text style={styles.setDelText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.hint}>Noch keine Sätze heute – trag deinen ersten ein:</Text>
            )}
            <View style={styles.inputRow}>
              <View style={styles.inputCol}>
                <Text style={styles.inputLabel}>Wiederholungen</Text>
                <TextInput style={styles.input} value={reps} onChangeText={setReps} placeholder="z. B. 10" placeholderTextColor={c.textMuted} keyboardType="numeric" />
              </View>
              <View style={styles.inputCol}>
                <Text style={styles.inputLabel}>Gewicht (kg)</Text>
                <TextInput style={styles.input} value={weight} onChangeText={setWeight} placeholder="optional" placeholderTextColor={c.textMuted} keyboardType="numeric" />
              </View>
            </View>
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={saveSet} disabled={saving}>
              {saving ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.saveText}>✓ Satz speichern</Text>}
            </TouchableOpacity>
            {sets.length > 0 && <Text style={styles.doneHint}>{sets.length} Satz{sets.length === 1 ? '' : 'e'} heute gespeichert 💪</Text>}
            {error && <Text style={styles.error}>{error}</Text>}
            <RestTimer c={c} autoStartSignal={restSignal} />
            {sessionId && (
              <TouchableOpacity style={styles.endBtn} onPress={endTraining} disabled={ending || saving}>
                {ending ? <ActivityIndicator color={c.success} /> : <Text style={styles.endText}>✓ Training beenden</Text>}
              </TouchableOpacity>
            )}
            {ended && (
              <Text style={styles.endedHint}>Training beendet 💪 Dein nächster Satz startet automatisch ein neues Training.</Text>
            )}
          </>
        )}
      </View>
    </ScrollView>
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
    illusWrap: { position: 'relative', marginTop: 30 },
    coachBodyClip: { position: 'absolute', top: -109, left: '50%', marginLeft: -105, width: 210, height: 110, overflow: 'hidden', zIndex: 1 },
    coachImgBody: { position: 'absolute', top: 0, left: 0, width: 210, height: 210 },
    coachArmsClip: { position: 'absolute', top: 0, left: '50%', marginLeft: -105, width: 210, height: 44, overflow: 'hidden', zIndex: 6 },
    coachImgArms: { position: 'absolute', top: -109, left: 0, width: 210, height: 210 },
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
  });
}
