// Fortschritt einer einzelnen Uebung: Gewichts-/Wdh-Verlauf, Rekord (+ geschaetztes 1RM)
// und die letzten Einheiten. Liest aus set_logs (+ workout_sessions fuer das Datum).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../contexts/ThemeContext';
import { LineChart, BarChart } from './Charts';
import { localDateStr, ddmm } from '../lib/date';
import { grp, unwrap } from '../lib/format';

type DayStat = { date: string; maxWeight: number; bestReps: number; maxReps: number; volume: number };

// unwrap & grp -> lib/format.ts; ddmm -> lib/date.ts

export default function ExerciseProgress({
  exerciseId, exerciseName, c, onBack,
}: {
  exerciseId: string; exerciseName: string; c: Colors; onBack: () => void;
}) {
  const { session } = useAuth();
  const styles = useMemo(() => makeStyles(c), [c]);
  const chartW = Math.min(560, Dimensions.get('window').width) - 72;

  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<DayStat[]>([]);
  const [record, setRecord] = useState<{ weight: number; reps: number; maxReps: number; oneRm: number }>({ weight: 0, reps: 0, maxReps: 0, oneRm: 0 });
  const [totalSets, setTotalSets] = useState(0);

  const load = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('set_logs')
      .select('reps, weight_kg, created_at, workout_sessions(performed_at)')
      .eq('user_id', userId)
      .eq('exercise_id', exerciseId);
    const sets = (data ?? []) as any[];

    const map = new Map<string, DayStat>();
    let recW = 0, recWReps = 0, recReps = 0, recOneRm = 0;
    for (const s of sets) {
      const w = Number(s.weight_kg) || 0;
      const r = Number(s.reps) || 0;
      const perf = unwrap<{ performed_at: string }>(s.workout_sessions);
      const date = localDateStr(perf?.performed_at ?? s.created_at);
      const cur = map.get(date) ?? { date, maxWeight: 0, bestReps: 0, maxReps: 0, volume: 0 };
      if (w > cur.maxWeight) { cur.maxWeight = w; cur.bestReps = r; }
      if (r > cur.maxReps) cur.maxReps = r;
      cur.volume += w * r;
      map.set(date, cur);
      // Rekorde
      if (w > recW) { recW = w; recWReps = r; }
      if (r > recReps) recReps = r;
      if (w > 0 && r > 0) { const e = w * (1 + r / 30); if (e > recOneRm) recOneRm = e; }
    }
    const arr = [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
    setDays(arr);
    setRecord({ weight: recW, reps: recWReps, maxReps: recReps, oneRm: Math.round(recOneRm) });
    setTotalSets(sets.length);
    setLoading(false);
  }, [session?.user?.id, exerciseId]);

  useEffect(() => { load(); }, [load]);

  const weighted = record.weight > 0;
  const weightDays = days.filter((d) => d.maxWeight > 0);
  const recent = [...days].reverse().slice(0, 8);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 48 }}>
      <TouchableOpacity onPress={onBack}><Text style={styles.back}>‹ Zurück</Text></TouchableOpacity>
      <Text style={styles.title}>{exerciseName}</Text>
      <Text style={styles.subtitle}>Dein Fortschritt 📈</Text>

      {loading ? (
        <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 50 }} />
      ) : totalSets === 0 ? (
        <Text style={styles.hint}>Für diese Übung hast du noch keine Sätze mitgeschrieben. Leg im Training los! 💪</Text>
      ) : (
        <>
          {/* REKORD */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🏆  Rekord</Text>
            <View style={styles.recRow}>
              {weighted ? (
                <>
                  <View style={styles.recCol}>
                    <Text style={styles.recBig}>{record.weight}</Text>
                    <Text style={styles.recUnit}>kg × {record.reps} Wdh</Text>
                  </View>
                  <View style={styles.recCol}>
                    <Text style={styles.recBigMuted}>{record.oneRm}</Text>
                    <Text style={styles.recUnit}>≈ 1RM (kg)</Text>
                  </View>
                </>
              ) : (
                <View style={styles.recCol}>
                  <Text style={styles.recBig}>{record.maxReps}</Text>
                  <Text style={styles.recUnit}>Wiederholungen</Text>
                </View>
              )}
              <View style={styles.recCol}>
                <Text style={styles.recBigMuted}>{totalSets}</Text>
                <Text style={styles.recUnit}>Sätze gesamt</Text>
              </View>
            </View>
          </View>

          {/* VERLAUF */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{weighted ? '📈  Gewichtsverlauf' : '📈  Wiederholungs-Verlauf'}</Text>
            {(weighted ? weightDays.length : days.length) >= 2 ? (
              <View style={styles.chartWrap}>
                <LineChart
                  values={weighted ? weightDays.map((d) => d.maxWeight) : days.map((d) => d.maxReps)}
                  width={chartW}
                  height={120}
                  color={c.primary}
                  c={c}
                  showMinMax
                />
                <View style={styles.chartAxis}>
                  <Text style={styles.axisLabel}>{ddmm((weighted ? weightDays : days)[0].date)}</Text>
                  <Text style={styles.axisLabel}>{ddmm((weighted ? weightDays : days)[(weighted ? weightDays : days).length - 1].date)}</Text>
                </View>
                <Text style={styles.caption}>{weighted ? 'Bestes Gewicht je Trainingstag' : 'Meiste Wiederholungen je Trainingstag'}</Text>
              </View>
            ) : (
              <Text style={styles.hint}>Ab dem 2. Trainingstag siehst du hier deine Kurve.</Text>
            )}
          </View>

          {/* VOLUMEN */}
          {weighted && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📊  Volumen je Einheit</Text>
              <BarChart
                values={recent.slice().reverse().map((d) => d.volume)}
                labels={recent.slice().reverse().map((d) => ddmm(d.date))}
                width={chartW}
                height={130}
                color={c.success}
                c={c}
              />
              <Text style={styles.caption}>Wiederholungen × Gewicht, summiert pro Trainingstag.</Text>
            </View>
          )}

          {/* LETZTE EINHEITEN */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🕑  Letzte Einheiten</Text>
            {recent.map((d, i) => (
              <View key={d.date} style={[styles.row, i === recent.length - 1 && styles.rowLast]}>
                <Text style={styles.rowDate}>{ddmm(d.date)}</Text>
                <Text style={styles.rowVal}>
                  {d.maxWeight > 0 ? `${d.maxWeight} kg × ${d.bestReps}` : `${d.maxReps} Wdh`}
                  {d.volume > 0 ? `  ·  ${grp(d.volume)} kg` : ''}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 60, paddingHorizontal: 20 },
    back: { color: c.primary, fontSize: 15, fontWeight: '600', marginBottom: 10 },
    title: { fontSize: 24, fontWeight: 'bold', color: c.heading },
    subtitle: { fontSize: 15, color: c.textMuted, marginTop: 2, marginBottom: 16 },
    card: { backgroundColor: c.card, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    cardTitle: { fontSize: 16, fontWeight: '700', color: c.heading, marginBottom: 12 },
    recRow: { flexDirection: 'row', justifyContent: 'space-around' },
    recCol: { alignItems: 'center' },
    recBig: { fontSize: 30, fontWeight: '800', color: c.heading },
    recBigMuted: { fontSize: 30, fontWeight: '800', color: c.textMuted },
    recUnit: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    chartWrap: { alignItems: 'center' },
    chartAxis: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 2 },
    axisLabel: { fontSize: 11, color: c.textMuted },
    caption: { fontSize: 11, color: c.textMuted, marginTop: 8, textAlign: 'center' },
    hint: { fontSize: 14, color: c.textMuted, lineHeight: 20, paddingVertical: 6 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    rowLast: { borderBottomWidth: 0 },
    rowDate: { fontSize: 15, color: c.textMuted, fontWeight: '600' },
    rowVal: { fontSize: 15, color: c.heading, fontWeight: '700' },
  });
}
