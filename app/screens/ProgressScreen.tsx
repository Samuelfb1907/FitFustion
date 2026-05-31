// Fortschritts-Dashboard: Gewichtsverlauf (mit Eingabe), Trainingsvolumen,
// persoenliche Rekorde und Trainingshistorie. Liest aus set_logs / workout_sessions
// / progress_entries. Keine DB-Aenderung noetig.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { LineChart, BarChart } from '../components/Charts';

type WeightPoint = { date: string; kg: number };
type PR = { name: string; weight: number; reps: number | null };
type HistRow = { date: string; sets: number; volume: number };

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
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
// 12530 -> "12.530" (deutsche Tausenderpunkte)
function grp(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function ddmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Eingebettete Relation kann Objekt ODER Array sein -> sicher entpacken
function unwrap<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

export default function ProgressScreen() {
  const { session } = useAuth();
  const c = useColors();
  const styles = makeStyles(c);

  const chartW = Math.min(560, Dimensions.get('window').width) - 72;

  const [loading, setLoading] = useState(true);
  const [weights, setWeights] = useState<WeightPoint[]>([]);
  const [profileWeight, setProfileWeight] = useState<number | null>(null);
  const [targetWeight, setTargetWeight] = useState<number | null>(null);
  const [stats, setStats] = useState({ sessions: 0, sets: 0, volume: 0, weekVolume: 0 });
  const [weekly, setWeekly] = useState<{ label: string; value: number }[]>([]);
  const [records, setRecords] = useState<PR[]>([]);
  const [history, setHistory] = useState<HistRow[]>([]);

  const [weightInput, setWeightInput] = useState('');
  const [savingW, setSavingW] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgErr, setMsgErr] = useState(false);

  const load = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    setLoading(true);

    // 1) Gewichtseintraege
    const { data: pe } = await supabase
      .from('progress_entries')
      .select('entry_date, weight_kg')
      .eq('user_id', userId)
      .order('entry_date', { ascending: true });
    const wpts: WeightPoint[] = (pe ?? [])
      .filter((r: any) => r.weight_kg != null)
      .map((r: any) => ({ date: String(r.entry_date), kg: Number(r.weight_kg) }));
    setWeights(wpts);

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
      .select('reps, weight_kg, session_id, created_at, exercises(name), workout_sessions(performed_at)')
      .eq('user_id', userId);
    const sets = (sl ?? []) as any[];

    const exName = (row: any): string => unwrap<{ name: string }>(row.exercises)?.name ?? 'Übung';
    const perfDate = (row: any): string => {
      const s = unwrap<{ performed_at: string }>(row.workout_sessions);
      return String(s?.performed_at ?? row.created_at).slice(0, 10);
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
      const name = exName(r);
      const cur = recMap.get(name);
      if (!cur || w > cur.weight) recMap.set(name, { name, weight: w, reps: r.reps != null ? Number(r.reps) : null });
    }
    setRecords([...recMap.values()].sort((a, b) => b.weight - a.weight).slice(0, 6));

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

    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveWeight() {
    const userId = session?.user?.id;
    if (!userId) return;
    const w = Number(weightInput.replace(',', '.'));
    if (!w || w < 30 || w > 300) {
      setMsg('Bitte ein gültiges Gewicht (30–300 kg) eingeben.');
      setMsgErr(true);
      return;
    }
    setSavingW(true);
    setMsg(null);
    const today = todayStr();
    const { data: ex } = await supabase
      .from('progress_entries')
      .select('id')
      .eq('user_id', userId)
      .eq('entry_date', today)
      .maybeSingle();
    const res = ex?.id
      ? await supabase.from('progress_entries').update({ weight_kg: w }).eq('id', ex.id)
      : await supabase.from('progress_entries').insert({ user_id: userId, entry_date: today, weight_kg: w });
    // aktuelles Profil-Gewicht mitziehen -> haelt Kalorienziel aktuell
    await supabase.from('profiles').update({ weight_kg: w }).eq('id', userId);
    setSavingW(false);
    if (res.error) {
      setMsg('Speichern fehlgeschlagen: ' + res.error.message);
      setMsgErr(true);
    } else {
      setMsg('Gewicht gespeichert ✓');
      setMsgErr(false);
      setWeightInput('');
      await load();
    }
  }

  const current = weights.length ? weights[weights.length - 1].kg : profileWeight;
  const start = weights.length ? weights[0].kg : null;
  const delta = current != null && start != null ? Math.round((current - start) * 10) / 10 : null;
  const towardGoal =
    current != null && start != null && targetWeight != null
      ? Math.abs(current - targetWeight) <= Math.abs(start - targetWeight)
      : null;
  const deltaColor = towardGoal == null ? c.textMuted : towardGoal ? c.success : c.danger;

  const statCards = [
    { icon: '🏋️', label: 'Trainings', value: String(stats.sessions) },
    { icon: '📋', label: 'Sätze gesamt', value: String(stats.sets) },
    { icon: '🏆', label: 'Volumen gesamt', value: `${grp(stats.volume)} kg` },
    { icon: '🔥', label: 'Diese Woche', value: `${grp(stats.weekVolume)} kg` },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 48 }}>
      <Text style={styles.title}>Fortschritt</Text>
      <Text style={styles.subtitle}>Deine Entwicklung auf einen Blick 📈</Text>

      {loading ? (
        <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 60 }} />
      ) : (
        <>
          {/* GEWICHT */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>⚖️  Gewichtsverlauf</Text>
            <View style={styles.weightRow}>
              <View style={styles.weightCol}>
                <Text style={styles.bigWeight}>{current != null ? `${current}` : '–'}</Text>
                <Text style={styles.weightUnit}>kg aktuell</Text>
              </View>
              {delta != null && (
                <View style={[styles.deltaChip, { borderColor: deltaColor }]}>
                  <Text style={[styles.deltaText, { color: deltaColor }]}>
                    {delta > 0 ? '+' : ''}
                    {delta} kg
                  </Text>
                  <Text style={styles.deltaSub}>seit Start</Text>
                </View>
              )}
              {targetWeight != null && (
                <View style={styles.weightCol}>
                  <Text style={styles.bigWeightMuted}>{targetWeight}</Text>
                  <Text style={styles.weightUnit}>kg Ziel</Text>
                </View>
              )}
            </View>

            {weights.length >= 2 ? (
              <View style={styles.chartWrap}>
                <LineChart values={weights.map((w) => w.kg)} width={chartW} height={120} color={c.primary} c={c} />
                <View style={styles.chartAxis}>
                  <Text style={styles.axisLabel}>{ddmm(weights[0].date)}</Text>
                  <Text style={styles.axisLabel}>{ddmm(weights[weights.length - 1].date)}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.hint}>Trag regelmäßig dein Gewicht ein – ab dem 2. Wert siehst du hier deine Kurve.</Text>
            )}

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={weightInput}
                onChangeText={setWeightInput}
                placeholder="Heutiges Gewicht (kg)"
                placeholderTextColor={c.textMuted}
                keyboardType="numeric"
              />
              <TouchableOpacity style={[styles.saveBtn, savingW && { opacity: 0.6 }]} onPress={saveWeight} disabled={savingW}>
                {savingW ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.saveText}>Eintragen</Text>}
              </TouchableOpacity>
            </View>
            {msg && <Text style={[styles.msg, { color: msgErr ? c.danger : c.success }]}>{msg}</Text>}
          </View>

          {/* STATISTIK-KACHELN */}
          <View style={styles.statGrid}>
            {statCards.map((s) => (
              <View key={s.label} style={styles.statCard}>
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
            <Text style={styles.cardTitle}>🏆  Persönliche Rekorde</Text>
            {records.length > 0 ? (
              records.map((r, i) => (
                <View key={r.name} style={[styles.row, i === records.length - 1 && styles.rowLast]}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={styles.rowValue}>
                    {r.weight} kg{r.reps ? ` · ${r.reps} Wdh` : ''}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.hint}>Noch keine Rekorde – trag im Training Sätze mit Gewicht ein.</Text>
            )}
          </View>

          {/* HISTORIE */}
          <View style={styles.card}>
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
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 60, paddingHorizontal: 20 },
    title: { fontSize: 26, fontWeight: 'bold', color: c.heading },
    subtitle: { fontSize: 15, color: c.textMuted, marginTop: 2, marginBottom: 16 },

    card: { backgroundColor: c.card, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    cardTitle: { fontSize: 16, fontWeight: '700', color: c.heading, marginBottom: 12 },

    weightRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    weightCol: { alignItems: 'center' },
    bigWeight: { fontSize: 34, fontWeight: 'bold', color: c.heading },
    bigWeightMuted: { fontSize: 28, fontWeight: '700', color: c.textMuted },
    weightUnit: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    deltaChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' },
    deltaText: { fontSize: 16, fontWeight: '700' },
    deltaSub: { fontSize: 10, color: c.textMuted, marginTop: 1 },

    chartWrap: { marginTop: 10, alignItems: 'center' },
    chartAxis: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 2 },
    axisLabel: { fontSize: 11, color: c.textMuted },

    inputRow: { flexDirection: 'row', gap: 10, marginTop: 14, alignItems: 'center' },
    input: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: c.inputBg, color: c.text },
    saveBtn: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
    saveText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
    msg: { fontSize: 13, textAlign: 'center', marginTop: 10 },

    statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 0 },
    statCard: { width: '48%', backgroundColor: c.card, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center', marginBottom: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    statIcon: { fontSize: 22 },
    statValue: { fontSize: 22, fontWeight: 'bold', color: c.heading, marginTop: 6 },
    statLabel: { fontSize: 12, color: c.textMuted, marginTop: 2, textAlign: 'center' },

    caption: { fontSize: 11, color: c.textMuted, marginTop: 8 },
    hint: { fontSize: 14, color: c.textMuted, lineHeight: 20, paddingVertical: 6 },

    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    rowLast: { borderBottomWidth: 0 },
    rowName: { fontSize: 15, color: c.text, flex: 1, marginRight: 10 },
    rowValue: { fontSize: 15, color: c.heading, fontWeight: '700' },
  });
}
