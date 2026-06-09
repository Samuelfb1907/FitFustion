// Fortschritts-Dashboard: Gewichtsverlauf (mit Eingabe), Trainingsvolumen,
// persoenliche Rekorde und Trainingshistorie. Liest aus set_logs / workout_sessions
// / progress_entries. Keine DB-Aenderung noetig.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { LineChart, BarChart } from '../components/Charts';
import SwipeBack from '../components/SwipeBack';
import GlassFill from '../components/GlassFill';
import ExerciseProgress from '../components/ExerciseProgress';
import ErrorRetry from '../components/ErrorRetry';
import Segmented from '../components/Segmented';
import LeaderboardScreen from './LeaderboardScreen';
import { useFocusTick } from '../lib/useFocusTick';
import { localDateStr, ddmm } from '../lib/date';
import { errorMessage } from '../lib/errors';
import { grp, unwrap } from '../lib/format';
import { CARD_SHADOW as shadow } from '../lib/ui';
import { WeightPoint, loadWeights, saveTodayWeight, deleteWeight, deltaOver, parseWeight, WEIGHT_MIN, WEIGHT_MAX } from '../lib/weight';

type PR = { id: string; name: string; weight: number; reps: number | null };
type ExItem = { id: string; name: string; sessions: number; lastDate: string };
type HistRow = { date: string; sets: number; volume: number };

function dStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Montag der Woche, in der d liegt (Wochenstart = Montag)
function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // 0 = Montag
  x.setDate(x.getDate() - day);
  return x;
}
// grp -> lib/format.ts
// ddmm -> lib/date.ts

// unwrap -> lib/format.ts

export default function ProgressScreen({ focusTick }: { focusTick?: number }) {
  const { session } = useAuth();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const chartW = Math.min(560, Dimensions.get('window').width) - 72;

  const [loading, setLoading] = useState(true);
  const [weights, setWeights] = useState<WeightPoint[]>([]);
  const [profileWeight, setProfileWeight] = useState<number | null>(null);
  const [targetWeight, setTargetWeight] = useState<number | null>(null);
  const [stats, setStats] = useState({ sessions: 0, sets: 0, volume: 0, weekVolume: 0 });
  const [weekly, setWeekly] = useState<{ label: string; value: number }[]>([]);
  const [records, setRecords] = useState<PR[]>([]);
  const [history, setHistory] = useState<HistRow[]>([]);
  const [exList, setExList] = useState<ExItem[]>([]);
  const [selExercise, setSelExercise] = useState<{ id: string; name: string } | null>(null);

  const [weightInput, setWeightInput] = useState('');
  const [savingW, setSavingW] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgErr, setMsgErr] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [seg, setSeg] = useState<'me' | 'board'>('me');

  const load = useCallback(async (silent = false) => {
    const userId = session?.user?.id;
    if (!userId) return;
    if (!silent) setLoading(true);

    try {
    // 1) Gewichtseintraege
    setWeights(await loadWeights(userId));

    // Profil-Gewicht (Fallback fuer "aktuell")
    const { data: prof } = await supabase.from('profiles').select('weight_kg').eq('id', userId).maybeSingle();
    setProfileWeight(prof?.weight_kg != null ? Number(prof.weight_kg) : null);

    // Ziel-Gewicht
    const { data: goal } = await supabase
      .from('goals')
      .select('target_weight_kg')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setTargetWeight(goal?.target_weight_kg != null ? Number(goal.target_weight_kg) : null);

    // 2) Saetze inkl. Uebung + Session-Datum
    const { data: sl } = await supabase
      .from('set_logs')
      .select('reps, weight_kg, session_id, exercise_id, created_at, exercises(name), workout_sessions(performed_at)')
      .eq('user_id', userId);
    const sets = (sl ?? []) as any[];

    const exName = (row: any): string => unwrap<{ name: string }>(row.exercises)?.name ?? 'Übung';
    const exId = (row: any): string => String(row.exercise_id);
    const perfDate = (row: any): string => {
      const s = unwrap<{ performed_at: string }>(row.workout_sessions);
      return localDateStr(s?.performed_at ?? row.created_at);
    };
    const vol = (row: any): number => (Number(row.reps) || 0) * (Number(row.weight_kg) || 0);

    // Gesamtstatistik
    let totalVolume = 0;
    for (const r of sets) totalVolume += vol(r);

    const sessRes = await supabase.from('workout_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId);
    const totalSessions = sessRes.count ?? 0;

    const monday = mondayOf(new Date());
    const mondayStr = dStr(monday);
    let weekVolume = 0;
    for (const r of sets) if (perfDate(r) >= mondayStr) weekVolume += vol(r);

    setStats({ sessions: totalSessions, sets: sets.length, volume: Math.round(totalVolume), weekVolume: Math.round(weekVolume) });

    // 3) Persoenliche Rekorde: hoechstes Gewicht je Uebung
    const recMap = new Map<string, PR>();
    for (const r of sets) {
      const w = Number(r.weight_kg) || 0;
      if (w <= 0) continue;
      const id = exId(r);
      const cur = recMap.get(id);
      if (!cur || w > cur.weight) recMap.set(id, { id, name: exName(r), weight: w, reps: r.reps != null ? Number(r.reps) : null });
    }
    setRecords([...recMap.values()].sort((a, b) => b.weight - a.weight).slice(0, 6));

    // 3b) Uebungsliste: alle Uebungen mit mitgeschriebenen Saetzen (auch ohne Gewicht)
    const exMap = new Map<string, { id: string; name: string; sessions: Set<string>; lastDate: string }>();
    for (const r of sets) {
      const id = exId(r);
      const e = exMap.get(id) ?? { id, name: exName(r), sessions: new Set<string>(), lastDate: '' };
      e.sessions.add(String(r.session_id));
      const d = perfDate(r);
      if (d > e.lastDate) e.lastDate = d;
      exMap.set(id, e);
    }
    setExList([...exMap.values()].map((e) => ({ id: e.id, name: e.name, sessions: e.sessions.size, lastDate: e.lastDate })).sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1)));

    // 4) Volumen je Woche (letzte 8 Wochen)
    const weekKeys: string[] = [];
    for (let i = 7; i >= 0; i--) {
      const m = new Date(monday);
      m.setDate(m.getDate() - i * 7);
      weekKeys.push(dStr(m));
    }
    const weekVol = new Map<string, number>(weekKeys.map((k) => [k, 0]));
    for (const r of sets) {
      const wk = dStr(mondayOf(new Date(perfDate(r))));
      if (weekVol.has(wk)) weekVol.set(wk, (weekVol.get(wk) || 0) + vol(r));
    }
    setWeekly(weekKeys.map((k) => ({ label: ddmm(k), value: Math.round(weekVol.get(k) || 0) })));

    // 5) Historie: je Session gruppieren
    const histMap = new Map<string, HistRow>();
    for (const r of sets) {
      const sid = String(r.session_id);
      const cur = histMap.get(sid);
      if (cur) {
        cur.sets += 1;
        cur.volume += vol(r);
      } else {
        histMap.set(sid, { date: perfDate(r), sets: 1, volume: vol(r) });
      }
    }
    const hist = [...histMap.values()]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 8)
      .map((h) => ({ ...h, volume: Math.round(h.volume) }));
    setHistory(hist);

    setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Reiter erneut angetippt -> Detailansicht schliessen + leise aktualisieren (ohne Spinner)
  useFocusTick(focusTick, () => { setSelExercise(null); setSeg('me'); load(true); });

  const onRefresh = useCallback(() => { setRefreshing(true); load(true); }, [load]);

  async function saveWeight() {
    const userId = session?.user?.id;
    if (!userId) return;
    const w = parseWeight(weightInput);
    if (w == null) {
      setMsg(`Bitte ein gültiges Gewicht (${WEIGHT_MIN}–${WEIGHT_MAX} kg) eingeben.`);
      setMsgErr(true);
      return;
    }
    setSavingW(true);
    setMsg(null);
    const err = await saveTodayWeight(userId, w);
    setSavingW(false);
    if (err) {
      setMsg('Speichern fehlgeschlagen: ' + err);
      setMsgErr(true);
    } else {
      setMsg('Gewicht gespeichert ✓');
      setMsgErr(false);
      setWeightInput('');
      await load();
    }
  }

  async function removeWeight(id: string) {
    const err = await deleteWeight(id);
    if (err) { Alert.alert('Löschen fehlgeschlagen', err); return; }
    await load();
  }
  function confirmRemoveWeight(id: string) {
    Alert.alert('Eintrag löschen?', 'Dieser Gewichtseintrag wird dauerhaft entfernt und verändert deine Verlaufskurve.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => removeWeight(id) },
    ]);
  }

  const current = weights.length ? weights[weights.length - 1].kg : profileWeight;
  const start = weights.length ? weights[0].kg : null;
  const delta = current != null && start != null && weights.length >= 2 ? Math.round((current - start) * 10) / 10 : null;
  // Chart auf die letzten ~120 Eintraege begrenzen (Performance bei langer Historie).
  const chartWeights = weights.length > 120 ? weights.slice(-120) : weights;
  const d7 = deltaOver(weights, 7);
  const d30 = deltaOver(weights, 30);
  // Vorzeichen Richtung Ziel (ueber=abnehmen gut, unter=zunehmen gut). Ohne Ziel neutral.
  const desiredSign = targetWeight != null && current != null ? Math.sign(targetWeight - current) : 0;
  const deltaCol = (d: number | null): string => {
    if (d == null || d === 0 || desiredSign === 0) return c.textMuted;
    return Math.sign(d) === desiredSign ? c.success : c.danger;
  };
  const toGoal = targetWeight != null && current != null ? Math.round(Math.abs(current - targetWeight) * 10) / 10 : null;
  const goalProgress =
    targetWeight != null && start != null && current != null && Math.abs(start - targetWeight) > 0.01
      ? Math.max(0, Math.min(1, (Math.abs(start - targetWeight) - Math.abs(current - targetWeight)) / Math.abs(start - targetWeight)))
      : null;

  const statCards = [
    { icon: '🏋️', label: 'Trainings', value: String(stats.sessions) },
    { icon: '📋', label: 'Sätze gesamt', value: String(stats.sets) },
    { icon: '🏆', label: 'Volumen gesamt', value: `${grp(stats.volume)} kg` },
    { icon: '🔥', label: 'Diese Woche', value: `${grp(stats.weekVolume)} kg` },
  ];

  const baseView = (
    <View style={styles.container}>
      <Text style={styles.title}>Fortschritt</Text>
      <View style={{ height: 14 }} />
      <Segmented
        options={[{ key: 'me', label: 'Meine Werte' }, { key: 'board', label: '🏆 Bestenliste' }]}
        value={seg}
        onChange={(k) => setSeg(k as 'me' | 'board')}
        c={c}
      />
      {seg === 'board' ? (
        <View style={{ flex: 1, marginTop: 14 }}><LeaderboardScreen embedded /></View>
      ) : (
      <ScrollView
        style={{ flex: 1, marginTop: 8 }}
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
      >
      <Text style={styles.subtitle}>Deine Entwicklung auf einen Blick 📈</Text>

      {loading ? (
        <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 60 }} />
      ) : loadError ? (
        <ErrorRetry message={loadError} onRetry={() => load()} />
      ) : (
        <>
          {/* GEWICHT */}
          <View style={styles.card}>
            <GlassFill radius={16} />
            <Text style={styles.cardTitle}>⚖️  Gewichtsverlauf</Text>
            <View style={styles.weightRow}>
              <View style={styles.weightCol}>
                <Text style={styles.bigWeight}>{current != null ? `${current}` : '–'}</Text>
                <Text style={styles.weightUnit}>kg aktuell</Text>
              </View>
              {targetWeight != null && (
                <View style={styles.weightCol}>
                  <Text style={styles.bigWeightMuted}>{targetWeight}</Text>
                  <Text style={styles.weightUnit}>kg Ziel</Text>
                </View>
              )}
            </View>

            {(d7 != null || d30 != null || delta != null) && (
              <View style={styles.deltaGrid}>
                <DeltaChip label="7 Tage" value={d7} color={deltaCol(d7)} styles={styles} />
                <DeltaChip label="30 Tage" value={d30} color={deltaCol(d30)} styles={styles} />
                <DeltaChip label="seit Start" value={delta} color={deltaCol(delta)} styles={styles} />
              </View>
            )}

            {weights.length >= 2 ? (
              <View style={styles.chartWrap}>
                <LineChart values={chartWeights.map((w) => w.kg)} width={chartW} height={120} color={c.primary} c={c} goal={targetWeight} showMinMax />
                <View style={styles.chartAxis}>
                  <Text style={styles.axisLabel}>{ddmm(chartWeights[0].date)}</Text>
                  <Text style={styles.axisLabel}>{ddmm(chartWeights[chartWeights.length - 1].date)}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.hint}>Trag regelmäßig dein Gewicht ein – ab dem 2. Wert siehst du hier deine Kurve.</Text>
            )}

            {goalProgress != null && toGoal != null && (
              <View style={styles.goalWrap}>
                <View style={styles.goalHead}>
                  <Text style={styles.goalCaption}>Ziel-Fortschritt</Text>
                  <Text style={styles.goalCaption}>{toGoal === 0 ? 'erreicht 🎉' : `noch ${toGoal} kg`}</Text>
                </View>
                <View style={styles.goalTrack}>
                  <View style={[styles.goalFill, { width: `${Math.round(goalProgress * 100)}%` }]} />
                </View>
              </View>
            )}

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={weightInput}
                onChangeText={setWeightInput}
                placeholder="Heutiges Gewicht (kg)"
                placeholderTextColor={c.textMuted}
                keyboardType="numeric"
                inputMode="decimal"
              />
              <TouchableOpacity style={[styles.saveBtn, savingW && { opacity: 0.6 }]} onPress={saveWeight} disabled={savingW}>
                {savingW ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.saveText}>Eintragen</Text>}
              </TouchableOpacity>
            </View>
            {msg && <Text style={[styles.msg, { color: msgErr ? c.danger : c.success }]}>{msg}</Text>}

            {weights.length > 0 && (
              <>
                <TouchableOpacity onPress={() => setShowHist((s) => !s)} style={styles.histToggle}>
                  <Text style={styles.histToggleText}>{showHist ? 'Verlauf ausblenden' : `Verlauf anzeigen (${weights.length})`}</Text>
                </TouchableOpacity>
                {showHist &&
                  [...weights].reverse().map((w) => (
                    <View key={w.id} style={styles.histRow}>
                      <Text style={styles.histDate}>{ddmm(w.date)}</Text>
                      <Text style={styles.histKg}>{w.kg} kg</Text>
                      <TouchableOpacity onPress={() => confirmRemoveWeight(w.id)} style={styles.histDel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={`Gewichtseintrag ${w.kg} kg löschen`}>
                        <Text style={styles.histDelText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
              </>
            )}
          </View>

          {/* STATISTIK-KACHELN */}
          <View style={styles.statGrid}>
            {statCards.map((s) => (
              <View key={s.label} style={styles.statCard}>
                <GlassFill radius={16} />
                <Text style={styles.statIcon}>{s.icon}</Text>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                  {s.value}
                </Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* VOLUMEN JE WOCHE */}
          <View style={styles.card}>
            <GlassFill radius={16} />
            <Text style={styles.cardTitle}>📊  Volumen je Woche</Text>
            {stats.volume > 0 ? (
              <>
                <BarChart
                  values={weekly.map((w) => w.value)}
                  labels={weekly.map((w) => w.label)}
                  width={chartW}
                  height={130}
                  color={c.success}
                  c={c}
                />
                <Text style={styles.caption}>Wiederholungen × Gewicht, summiert pro Kalenderwoche (Mo–So).</Text>
              </>
            ) : (
              <Text style={styles.hint}>Sobald du Sätze mit Gewicht mitschreibst, erscheint hier dein Wochenvolumen.</Text>
            )}
          </View>

          {/* REKORDE */}
          <View style={styles.card}>
            <GlassFill radius={16} />
            <Text style={styles.cardTitle}>🏆  Persönliche Rekorde</Text>
            {records.length > 0 ? (
              records.map((r, i) => (
                <TouchableOpacity key={r.id} style={[styles.row, i === records.length - 1 && styles.rowLast]} onPress={() => setSelExercise({ id: r.id, name: r.name })} activeOpacity={0.7}>
                  <Text style={styles.rowName} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.rowValue}>{r.weight} kg{r.reps ? ` · ${r.reps} Wdh` : ''}  ›</Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.hint}>Noch keine Rekorde – trag im Training Sätze mit Gewicht ein.</Text>
            )}
          </View>

          {/* UEBUNGS-FORTSCHRITT */}
          {exList.length > 0 && (
            <View style={styles.card}>
              <GlassFill radius={16} />
              <Text style={styles.cardTitle}>📈  Übungs-Fortschritt</Text>
              <Text style={[styles.caption, { marginTop: 0, marginBottom: 8 }]}>Tippe eine Übung für Verlauf & Rekord.</Text>
              {exList.slice(0, 12).map((e, i) => (
                <TouchableOpacity key={e.id} style={[styles.row, i === Math.min(exList.length, 12) - 1 && styles.rowLast]} onPress={() => setSelExercise({ id: e.id, name: e.name })} activeOpacity={0.7}>
                  <Text style={styles.rowName} numberOfLines={1}>{e.name}</Text>
                  <Text style={styles.rowValue}>{e.sessions}×  ›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* HISTORIE */}
          <View style={styles.card}>
            <GlassFill radius={16} />
            <Text style={styles.cardTitle}>🕑  Trainingshistorie</Text>
            {history.length > 0 ? (
              history.map((h, i) => (
                <View key={`${h.date}-${i}`} style={[styles.row, i === history.length - 1 && styles.rowLast]}>
                  <Text style={styles.rowName}>{ddmm(h.date)}</Text>
                  <Text style={styles.rowValue}>
                    {h.sets} Satz{h.sets === 1 ? '' : 'e'}
                    {h.volume > 0 ? ` · ${grp(h.volume)} kg` : ''}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.hint}>Noch keine Einheiten – leg im Training los! 💪</Text>
            )}
          </View>
        </>
      )}
    </ScrollView>
      )}
    </View>
  );

  if (selExercise) {
    return (
      <SwipeBack onBack={() => setSelExercise(null)} c={c} behind={baseView}>
        <ExerciseProgress exerciseId={selExercise.id} exerciseName={selExercise.name} c={c} onBack={() => setSelExercise(null)} />
      </SwipeBack>
    );
  }

  return baseView;
}

function DeltaChip({ label, value, color, styles }: { label: string; value: number | null; color: string; styles: any }) {
  return (
    <View style={styles.deltaCell}>
      <Text style={[styles.deltaCellVal, { color }]}>{value == null ? '–' : `${value > 0 ? '+' : ''}${value}`}</Text>
      <Text style={styles.deltaCellLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent', paddingTop: 56, paddingHorizontal: 16 },
    title: { fontSize: 26, fontWeight: '800', color: c.heading },
    subtitle: { fontSize: 15, color: c.textMuted, marginTop: 2, marginBottom: 16 },

    card: { ...shadow, backgroundColor: c.card, borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: c.cardBorder },
    cardTitle: { fontSize: 16, fontWeight: '700', color: c.heading, marginBottom: 12 },

    weightRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    weightCol: { alignItems: 'center' },
    bigWeight: { fontSize: 34, fontWeight: 'bold', color: c.heading },
    bigWeightMuted: { fontSize: 28, fontWeight: '700', color: c.textMuted },
    weightUnit: { fontSize: 12, color: c.textMuted, marginTop: 2 },

    deltaGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, gap: 8 },
    deltaCell: { flex: 1, backgroundColor: c.inputBg, borderRadius: 16, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: c.cardBorder },
    deltaCellVal: { fontSize: 17, fontWeight: '800' },
    deltaCellLabel: { fontSize: 12, color: c.textMuted, marginTop: 2 },

    goalWrap: { marginTop: 14 },
    goalHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    goalCaption: { fontSize: 12, color: c.textMuted, fontWeight: '600' },
    goalTrack: { height: 8, backgroundColor: c.track, borderRadius: 4, overflow: 'hidden' },
    goalFill: { height: 8, backgroundColor: c.success, borderRadius: 4 },

    histToggle: { marginTop: 14, alignItems: 'center' },
    histToggleText: { color: c.primary, fontSize: 14, fontWeight: '600' },
    histRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    histDate: { fontSize: 14, color: c.textMuted, width: 64 },
    histKg: { fontSize: 15, color: c.heading, fontWeight: '700', flex: 1 },
    histDel: { padding: 6 },
    histDelText: { fontSize: 14, color: c.textMuted },

    chartWrap: { marginTop: 10, alignItems: 'center' },
    chartAxis: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 2 },
    axisLabel: { fontSize: 11, color: c.textMuted },

    inputRow: { flexDirection: 'row', gap: 10, marginTop: 14, alignItems: 'center' },
    input: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, backgroundColor: c.inputBg, color: c.text },
    saveBtn: { backgroundColor: c.primary, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
    saveText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
    msg: { fontSize: 13, textAlign: 'center', marginTop: 10 },

    statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 0 },
    statCard: { ...shadow, width: '48%', backgroundColor: c.card, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 12, alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: c.cardBorder },
    statIcon: { fontSize: 22 },
    statValue: { fontSize: 22, fontWeight: 'bold', color: c.heading, marginTop: 6 },
    statLabel: { fontSize: 12, color: c.textMuted, marginTop: 2, textAlign: 'center' },

    caption: { fontSize: 12, color: c.textMuted, marginTop: 8 },
    hint: { fontSize: 14, color: c.textMuted, lineHeight: 20, paddingVertical: 6 },

    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    rowLast: { borderBottomWidth: 0 },
    rowName: { fontSize: 15, color: c.text, flex: 1, marginRight: 10 },
    rowValue: { fontSize: 15, color: c.heading, fontWeight: '700' },
  });
}
