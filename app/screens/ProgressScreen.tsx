// Fortschritts-Dashboard: Gewichtsverlauf (mit Eingabe), Trainingsvolumen,
// persoenliche Rekorde und Trainingshistorie. Liest aus set_logs / workout_sessions
// / progress_entries. Keine DB-Aenderung noetig.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Platform, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePaywall } from '../components/Paywall';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart } from '../components/Charts';
import SwipeBack from '../components/SwipeBack';
import { useAndroidBack } from '../lib/useBackHandler';
import GlassFill from '../components/GlassFill';
import ExerciseProgress from '../components/ExerciseProgress';
import ErrorRetry from '../components/ErrorRetry';
import { TAB_BAR_SPACE } from '../lib/layout';
import Segmented from '../components/Segmented';
import LeaderboardScreen from './LeaderboardScreen';
import { useFocusTick } from '../lib/useFocusTick';
import { localDateStr, ddmm } from '../lib/date';
import { errorMessage } from '../lib/errors';
import { computeStreak } from '../lib/gamification';
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

export default function ProgressScreen({ focusTick, focused = true }: { focusTick?: number; focused?: boolean }) {
  const { session, isPremium } = useAuth();
  const { openPaywall } = usePaywall();
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);

  const chartW = Math.min(560, Dimensions.get('window').width) - 72;

  const [loading, setLoading] = useState(true);
  const [weights, setWeights] = useState<WeightPoint[]>([]);
  const [profileWeight, setProfileWeight] = useState<number | null>(null);
  const [targetWeight, setTargetWeight] = useState<number | null>(null);
  const [stats, setStats] = useState({ sessions: 0, sets: 0, volume: 0, weekVolume: 0 });
  const [weekStats, setWeekStats] = useState({ workouts: 0, sets: 0, streak: 0 });
  const [sharing, setSharing] = useState(false);
  const [weekly, setWeekly] = useState<{ label: string; value: number }[]>([]);
  const [records, setRecords] = useState<PR[]>([]);
  const [history, setHistory] = useState<HistRow[]>([]);
  const [exList, setExList] = useState<ExItem[]>([]);
  const [selExercise, setSelExercise] = useState<{ id: string; name: string } | null>(null);

  // Android-System-Zurueck: offene Uebungs-Detailansicht schliessen (sonst Fallback in MainTabs).
  useAndroidBack(() => {
    if (selExercise) { setSelExercise(null); return true; }
    return false;
  }, focused);

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

    const exName = (row: any): string => unwrap<{ name: string }>(row.exercises)?.name ?? t('progress.exerciseFallback');
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

    // Wochenwerte fuer die teilbare "Deine Woche"-Karte.
    const weekSessions = new Set<string>();
    let weekSetCount = 0;
    for (const r of sets) {
      if (perfDate(r) >= mondayStr) { weekSessions.add(String(r.session_id)); weekSetCount++; }
    }
    setWeekStats({ workouts: weekSessions.size, sets: weekSetCount, streak: computeStreak([...new Set(sets.map(perfDate))]) });

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
      setMsg(t('progress.weightInvalid', { min: WEIGHT_MIN, max: WEIGHT_MAX }));
      setMsgErr(true);
      return;
    }
    setSavingW(true);
    setMsg(null);
    const err = await saveTodayWeight(userId, w);
    setSavingW(false);
    if (err) {
      setMsg(t('progress.saveFailed', { err }));
      setMsgErr(true);
    } else {
      setMsg(t('progress.weightSaved'));
      setMsgErr(false);
      setWeightInput('');
      await load();
    }
  }

  // Wochen-Zusammenfassung als Text teilen (RN Share). Keine Rezepte, keine sensiblen Daten.
  async function shareWeek() {
    if (sharing) return;
    setSharing(true);
    try {
      const message = t('progress.shareBody', {
        workouts: weekStats.workouts,
        sets: weekStats.sets,
        kg: stats.weekVolume,
        streak: weekStats.streak,
        url: t('progress.shareUrl'),
      });
      await Share.share(
        Platform.OS === 'ios' ? { message, url: t('progress.shareUrl') } : { message },
        { dialogTitle: t('progress.shareButton') },
      );
    } catch {
      // Teilen abgebrochen/fehlgeschlagen -> still ignorieren.
    } finally {
      setSharing(false);
    }
  }

  async function removeWeight(id: string) {
    const err = await deleteWeight(id);
    if (err) { Alert.alert(t('progress.deleteFailedTitle'), err); return; }
    await load();
  }
  function confirmRemoveWeight(id: string) {
    Alert.alert(t('progress.deleteConfirmTitle'), t('progress.deleteConfirmBody'), [
      { text: t('progress.cancel'), style: 'cancel' },
      { text: t('progress.delete'), style: 'destructive', onPress: () => removeWeight(id) },
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

  // Kachel-Daten: Ionicons-Name + Farbton (Icon-Chip) je Statistik.
  const statCards = [
    { icon: 'barbell', fg: c.primary, bg: 'rgba(25,201,143,0.12)', label: t('progress.statSessions'), value: String(stats.sessions) },
    { icon: 'clipboard', fg: '#3FA9F5', bg: 'rgba(63,169,245,0.12)', label: t('progress.statSets'), value: String(stats.sets) },
    { icon: 'trophy', fg: '#9D7BF4', bg: 'rgba(157,123,244,0.14)', label: t('progress.statVolume'), value: `${grp(stats.volume)} kg` },
    { icon: 'flame', fg: '#F0B429', bg: 'rgba(240,180,41,0.12)', label: t('progress.statWeek'), value: `${grp(stats.weekVolume)} kg` },
  ];

  const baseView = (
    <View style={styles.container}>
      <Text style={styles.title}>{t('progress.title')}</Text>
      <View style={{ height: 14 }} />
      <Segmented
        options={[{ key: 'me', label: t('progress.tabMyValues') }, { key: 'board', label: t('progress.tabLeaderboard') }]}
        value={seg}
        onChange={(k) => { if (k === 'board' && !isPremium) { openPaywall('leaderboard'); return; } setSeg(k as 'me' | 'board'); }}
        c={c}
      />
      {seg === 'board' ? (
        <View style={{ flex: 1, marginTop: 14 }}><LeaderboardScreen embedded /></View>
      ) : (
      <ScrollView
        style={{ flex: 1, marginTop: 8 }}
        contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
      >
      <Text style={styles.subtitle}>{t('progress.subtitle')}</Text>

      {loading ? (
        <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 60 }} />
      ) : loadError ? (
        <ErrorRetry message={loadError} onRetry={() => load()} />
      ) : (
        <>
          {/* GEWICHT */}
          <View style={styles.card}>
            <GlassFill radius={20} />
            <View style={styles.cardHead}>
              <Ionicons name="scale" size={14} color={c.textMuted} />
              <Text style={styles.cardLabel} numberOfLines={1}>{t('progress.weightCardTitle')}</Text>
            </View>
            <View style={styles.weightRow}>
              <View style={styles.weightCol}>
                <Text style={styles.bigWeight} numberOfLines={1}>{current != null ? `${current}` : '–'}</Text>
                <Text style={styles.weightUnit} numberOfLines={1}>{t('progress.kgCurrent')}</Text>
              </View>
              {targetWeight != null && (
                <View style={styles.weightCol}>
                  <Text style={styles.bigWeightMuted} numberOfLines={1}>{targetWeight}</Text>
                  <Text style={styles.weightUnit} numberOfLines={1}>{t('progress.kgGoal')}</Text>
                </View>
              )}
            </View>

            {(d7 != null || d30 != null || delta != null) && (
              <View style={styles.deltaGrid}>
                <DeltaChip label={t('progress.delta7')} value={d7} color={deltaCol(d7)} styles={styles} />
                <DeltaChip label={t('progress.delta30')} value={d30} color={deltaCol(d30)} styles={styles} />
                <DeltaChip label={t('progress.deltaSinceStart')} value={delta} color={deltaCol(delta)} styles={styles} />
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
              <Text style={styles.hint}>{t('progress.chartHint')}</Text>
            )}

            {goalProgress != null && toGoal != null && (
              <View style={styles.goalWrap}>
                <View style={styles.goalHead}>
                  <Text style={styles.goalCaption}>{t('progress.goalProgress')}</Text>
                  <Text style={styles.goalCaption}>{toGoal === 0 ? t('progress.goalReached') : t('progress.goalRemaining', { n: toGoal })}</Text>
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
                placeholder={t('progress.weightPlaceholder')}
                placeholderTextColor={c.textMuted}
                keyboardType="numeric"
                inputMode="decimal"
              />
              <TouchableOpacity style={[styles.saveBtn, savingW && { opacity: 0.6 }]} onPress={saveWeight} disabled={savingW}>
                {savingW ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.saveText}>{t('progress.submit')}</Text>}
              </TouchableOpacity>
            </View>
            {msg && <Text style={[styles.msg, { color: msgErr ? c.danger : c.success }]}>{msg}</Text>}

            {weights.length > 0 && (
              <>
                <TouchableOpacity onPress={() => setShowHist((s) => !s)} style={styles.histToggle}>
                  <Text style={styles.histToggleText}>{showHist ? t('progress.historyHide') : t('progress.historyShow', { n: weights.length })}</Text>
                </TouchableOpacity>
                {showHist &&
                  [...weights].reverse().map((w) => (
                    <View key={w.id} style={styles.histRow}>
                      <Text style={styles.histDate}>{ddmm(w.date)}</Text>
                      <Text style={styles.histKg}>{w.kg} kg</Text>
                      <TouchableOpacity onPress={() => confirmRemoveWeight(w.id)} style={styles.histDel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('progress.deleteWeightA11y', { n: w.kg })}>
                        <Ionicons name="close" size={16} color={c.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
              </>
            )}
          </View>

          {(weekStats.workouts > 0 || weekStats.sets > 0) && (
            <View style={styles.card}>
              <GlassFill radius={20} />
              <View style={styles.cardHead}>
                <Ionicons name="sparkles-outline" size={18} color={c.primary} />
                <Text style={styles.cardLabel}>{t('progress.shareCardTitle')}</Text>
              </View>
              <TouchableOpacity style={styles.shareBtn} onPress={shareWeek} disabled={sharing} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('progress.shareButton')}>
                <Ionicons name="share-social-outline" size={18} color={c.onPrimary} />
                <Text style={styles.shareBtnText}>{t('progress.shareButton')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STATISTIK-KACHELN (Icon-Chip + Wert + Unterzeile, wie Home) */}
          <View style={styles.statGrid}>
            {statCards.map((s) => (
              <View key={s.label} style={styles.statCard}>
                <GlassFill radius={20} />
                <View style={[styles.statChip, { backgroundColor: s.bg }]}>
                  <Ionicons name={s.icon as any} size={19} color={s.fg} />
                </View>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                  {s.value}
                </Text>
                <Text style={styles.statLabel} numberOfLines={1}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* VOLUMEN JE WOCHE */}
          <View style={styles.card}>
            <GlassFill radius={20} />
            <View style={styles.cardHead}>
              <Ionicons name="stats-chart" size={14} color={c.textMuted} />
              <Text style={styles.cardLabel} numberOfLines={1}>{t('progress.weeklyVolumeTitle')}</Text>
            </View>
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
                <Text style={styles.caption}>{t('progress.weeklyVolumeCaption')}</Text>
              </>
            ) : (
              <Text style={styles.hint}>{t('progress.weeklyVolumeHint')}</Text>
            )}
          </View>

          {/* REKORDE */}
          <View style={styles.card}>
            <GlassFill radius={20} />
            <View style={styles.cardHead}>
              <Ionicons name="trophy" size={14} color={c.textMuted} />
              <Text style={styles.cardLabel} numberOfLines={1}>{t('progress.recordsTitle')}</Text>
            </View>
            {records.length > 0 ? (
              records.map((r, i) => (
                <TouchableOpacity key={r.id} style={[styles.row, i === records.length - 1 && styles.rowLast]} onPress={() => setSelExercise({ id: r.id, name: r.name })} activeOpacity={0.7}>
                  <Text style={styles.rowName} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.rowValue}>{r.weight} kg{r.reps ? ` · ${t('progress.reps', { n: r.reps })}` : ''}  ›</Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.hint}>{t('progress.recordsHint')}</Text>
            )}
          </View>

          {/* UEBUNGS-FORTSCHRITT */}
          {exList.length > 0 && (
            <View style={styles.card}>
              <GlassFill radius={20} />
              <View style={styles.cardHead}>
                <Ionicons name="trending-up" size={14} color={c.textMuted} />
                <Text style={styles.cardLabel} numberOfLines={1}>{t('progress.exerciseProgressTitle')}</Text>
              </View>
              <Text style={[styles.caption, { marginTop: 0, marginBottom: 8 }]}>{t('progress.exerciseProgressCaption')}</Text>
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
            <GlassFill radius={20} />
            <View style={styles.cardHead}>
              <Ionicons name="time" size={14} color={c.textMuted} />
              <Text style={styles.cardLabel} numberOfLines={1}>{t('progress.historyTitle')}</Text>
            </View>
            {history.length > 0 ? (
              history.map((h, i) => (
                <View key={`${h.date}-${i}`} style={[styles.row, i === history.length - 1 && styles.rowLast]}>
                  <Text style={styles.rowName}>{ddmm(h.date)}</Text>
                  <Text style={styles.rowValue}>
                    {h.sets === 1 ? t('progress.setsOne', { n: h.sets }) : t('progress.setsMany', { n: h.sets })}
                    {h.volume > 0 ? ` · ${grp(h.volume)} kg` : ''}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.hint}>{t('progress.historyHint')}</Text>
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
      <Text style={[styles.deltaCellVal, { color }]} numberOfLines={1}>{value == null ? '–' : `${value > 0 ? '+' : ''}${value}`}</Text>
      <Text style={styles.deltaCellLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent', paddingTop: 56, paddingHorizontal: 16 },
    title: { fontSize: 28, fontWeight: '800', color: c.heading, letterSpacing: -0.5 },
    subtitle: { fontSize: 15, color: c.textMuted, marginTop: 2, marginBottom: 16 },

    card: { ...shadow, backgroundColor: c.card, borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    // Karten-Kopf: kleines Icon + ALL-CAPS-Eyebrow (wie Home)
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
    cardLabel: { flexShrink: 1, fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: c.textMuted, textTransform: 'uppercase' },

    weightRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    weightCol: { alignItems: 'center', minWidth: 0 },
    bigWeight: { fontSize: 34, fontWeight: '800', color: c.heading, letterSpacing: -0.5 },
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
    histToggleText: { color: c.primary, fontSize: 14, fontWeight: '700' },
    histRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    histDate: { fontSize: 14, color: c.textMuted, width: 64 },
    histKg: { fontSize: 15, color: c.heading, fontWeight: '700', flex: 1 },
    histDel: { padding: 6 },

    chartWrap: { marginTop: 10, alignItems: 'center' },
    chartAxis: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 2 },
    axisLabel: { fontSize: 11, color: c.textMuted },

    inputRow: { flexDirection: 'row', gap: 10, marginTop: 14, alignItems: 'center' },
    input: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, backgroundColor: c.inputBg, color: c.text },
    saveBtn: { backgroundColor: c.primary, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
    saveText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
    msg: { fontSize: 13, textAlign: 'center', marginTop: 10 },

    // Statistik-Kacheln: 36px-Icon-Chip oben, Wert + Unterzeile darunter (wie Home)
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 0 },
    statCard: { ...shadow, width: '48%', backgroundColor: c.card, borderRadius: 20, paddingVertical: 15, paddingHorizontal: 13, marginBottom: 14, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    statChip: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    statValue: { fontSize: 21, fontWeight: '800', color: c.heading, marginTop: 12, letterSpacing: -0.3 },
    statLabel: { fontSize: 11, color: c.textMuted, fontWeight: '500', marginTop: 7 },

    caption: { fontSize: 12, color: c.textMuted, marginTop: 8 },
    shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.primary, borderRadius: 14, paddingVertical: 13, marginTop: 12 },
    shareBtnText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
    hint: { fontSize: 14, color: c.textMuted, lineHeight: 20, paddingVertical: 6 },

    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    rowLast: { borderBottomWidth: 0 },
    rowName: { fontSize: 15, color: c.text, flex: 1, marginRight: 10 },
    rowValue: { fontSize: 15, color: c.heading, fontWeight: '700' },
  });
}
