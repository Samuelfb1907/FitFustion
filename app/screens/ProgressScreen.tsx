// Fortschritts-Dashboard: Gewichtsverlauf (mit Eingabe), Trainingsvolumen,
// persoenliche Rekorde und Trainingshistorie. Liest aus set_logs / workout_sessions
// / progress_entries. Keine DB-Aenderung noetig.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Platform, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
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
import { loadMeasurements, addMeasurement, Measurement } from '../lib/measurements';
import { loadMuscleRecovery } from '../lib/muscleRecovery';
import { loadCareer, Career, milestones } from '../lib/career';
import { loadChallenges, ChallengeProgress } from '../lib/challenges';
import { loadTrophy, BadgeView } from '../lib/badges';
import { projectGoal } from '../lib/projection';
import { loadBingo, BingoResult } from '../lib/bingo';
import { loadThrowback, ThrowbackItem } from '../lib/throwback';
import TrophyRoom from '../components/TrophyRoom';
import WeeklyBingo from '../components/WeeklyBingo';
import ThrowbackCard from '../components/ThrowbackCard';
import ProgressPhotos from '../components/ProgressPhotos';
import CollapsibleCard from '../components/CollapsibleCard';
import Confetti from '../components/Confetti';
import * as Haptics from 'expo-haptics';
import MuscleHeatmap from '../components/MuscleHeatmap';
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

export default function ProgressScreen({ focusTick, focused = true, initialSeg }: { focusTick?: number; focused?: boolean; initialSeg?: 'me' | 'board' }) {
  const { session } = useAuth();
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
  const [meas, setMeas] = useState<Measurement[]>([]);
  const [recovery, setRecovery] = useState<Record<string, number>>({}); // Muskel-Key -> Tage seit letztem Training
  const [career, setCareer] = useState<Career | null>(null);
  const [challenges, setChallenges] = useState<ChallengeProgress[]>([]);
  const [trophies, setTrophies] = useState<BadgeView[]>([]);
  const [bingo, setBingo] = useState<BingoResult | null>(null);
  const [throwback, setThrowback] = useState<ThrowbackItem[]>([]);
  const [confettiKey, setConfettiKey] = useState(0);
  const [mInput, setMInput] = useState({ waist: '', chest: '', hips: '', arm: '', thigh: '' });
  const [savingM, setSavingM] = useState(false);
  const [mMsg, setMMsg] = useState<string | null>(null);
  useEffect(() => { const uid = session?.user?.id; if (uid) loadMeasurements(uid).then(setMeas).catch(() => {}); }, [session?.user?.id]);
  useEffect(() => { const uid = session?.user?.id; if (uid) loadMuscleRecovery(uid).then(setRecovery).catch(() => {}); }, [session?.user?.id, focusTick]);
  useEffect(() => { const uid = session?.user?.id; if (uid) loadCareer(uid).then(setCareer).catch(() => {}); }, [session?.user?.id, focusTick]);
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    loadChallenges(uid).then((res) => {
      setChallenges(res.items);
      if (res.newlyEarned.length > 0) {
        setConfettiKey((k) => k + 1);
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
        Alert.alert(t('challenges.celebrateTitle'), t('challenges.celebrateBody', { name: t(`challenges.${res.newlyEarned[0].key}.name`) }));
      }
    }).catch(() => {});
  }, [session?.user?.id, focusTick]);
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    loadTrophy(uid).then((res) => {
      setTrophies(res.items);
      if (res.newlyEarned.length > 0) {
        setConfettiKey((k) => k + 1);
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
        const names = res.newlyEarned.map((b) => t(`rewards.badge.${b.key}`)).join(', ');
        Alert.alert(t('rewards.earnedTitle', { n: res.newlyEarned.length }), t('rewards.earnedBody', { names }));
      }
    }).catch(() => {});
  }, [session?.user?.id, focusTick]);
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    loadThrowback(uid).then(setThrowback).catch(() => {});
    loadBingo(uid).then((res) => {
      setBingo(res);
      if (res.newFull || res.newLine) {
        setConfettiKey((k) => k + 1);
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
        Alert.alert(t('bingo.rewardTitle'), res.newFull ? t('bingo.rewardFull') : t('bingo.rewardLine'));
      }
    }).catch(() => {});
  }, [session?.user?.id, focusTick]);
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
  const [seg, setSeg] = useState<'me' | 'board'>(initialSeg ?? 'me');

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
  useFocusTick(focusTick, () => { setSelExercise(null); setSeg(initialSeg ?? 'me'); load(true); });

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

  async function saveMeasurement() {
    const uid = session?.user?.id;
    if (!uid || savingM) return;
    setSavingM(true); setMMsg(null);
    const toNum = (s: string) => { const n = Number(s.replace(',', '.')); return s.trim() && isFinite(n) ? n : null; };
    const err = await addMeasurement(uid, {
      waist_cm: toNum(mInput.waist), chest_cm: toNum(mInput.chest), hips_cm: toNum(mInput.hips),
      arm_cm: toNum(mInput.arm), thigh_cm: toNum(mInput.thigh),
    });
    setSavingM(false);
    if (err) { setMMsg(err); return; }
    setMInput({ waist: '', chest: '', hips: '', arm: '', thigh: '' });
    try { setMeas(await loadMeasurements(uid)); } catch {}
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
  // Ziel-Prognose: geschaetztes Datum, an dem das Zielgewicht beim aktuellen Tempo erreicht wird.
  const proj = projectGoal(weights, targetWeight);

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
        onChange={(k) => setSeg(k as 'me' | 'board')}
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
          <CollapsibleCard icon="scale" title={t('progress.weightCardTitle')} storageKey="weight">
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

            {proj?.status === 'ok' && (
              <View style={styles.projWrap}>
                <Ionicons name="flag" size={15} color={c.primary} />
                <Text style={styles.projText}>
                  {t('progress.projection', { date: proj.etaDate })} <Text style={styles.projRate}>· {t('progress.projectionRate', { n: proj.perWeek })}</Text>
                </Text>
              </View>
            )}
            {proj?.status === 'no_trend' && <Text style={styles.projMuted}>{t('progress.projectionNoTrend')}</Text>}
            {proj?.status === 'far' && <Text style={styles.projMuted}>{t('progress.projectionFar')}</Text>}

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
          </CollapsibleCard>

          {/* KOERPERMASSE (Umfaenge) */}
          <CollapsibleCard icon="body" title={t('progress.measTitle')} storageKey="measures" defaultCollapsed>
            <View style={styles.mGrid}>
              <View style={styles.mField}><Text style={styles.mLabel}>{t('progress.measWaist')}</Text><TextInput style={styles.mInput} value={mInput.waist} onChangeText={(v) => setMInput((p) => ({ ...p, waist: v }))} placeholder="–" placeholderTextColor={c.textMuted} keyboardType="numeric" inputMode="decimal" /></View>
              <View style={styles.mField}><Text style={styles.mLabel}>{t('progress.measChest')}</Text><TextInput style={styles.mInput} value={mInput.chest} onChangeText={(v) => setMInput((p) => ({ ...p, chest: v }))} placeholder="–" placeholderTextColor={c.textMuted} keyboardType="numeric" inputMode="decimal" /></View>
              <View style={styles.mField}><Text style={styles.mLabel}>{t('progress.measHips')}</Text><TextInput style={styles.mInput} value={mInput.hips} onChangeText={(v) => setMInput((p) => ({ ...p, hips: v }))} placeholder="–" placeholderTextColor={c.textMuted} keyboardType="numeric" inputMode="decimal" /></View>
              <View style={styles.mField}><Text style={styles.mLabel}>{t('progress.measArm')}</Text><TextInput style={styles.mInput} value={mInput.arm} onChangeText={(v) => setMInput((p) => ({ ...p, arm: v }))} placeholder="–" placeholderTextColor={c.textMuted} keyboardType="numeric" inputMode="decimal" /></View>
              <View style={styles.mField}><Text style={styles.mLabel}>{t('progress.measThigh')}</Text><TextInput style={styles.mInput} value={mInput.thigh} onChangeText={(v) => setMInput((p) => ({ ...p, thigh: v }))} placeholder="–" placeholderTextColor={c.textMuted} keyboardType="numeric" inputMode="decimal" /></View>
            </View>
            <TouchableOpacity style={[styles.saveBtn, { marginTop: 12 }, savingM && { opacity: 0.6 }]} onPress={saveMeasurement} disabled={savingM}>
              {savingM ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.saveText}>{t('progress.submit')}</Text>}
            </TouchableOpacity>
            {mMsg && <Text style={[styles.msg, { color: c.danger }]}>{mMsg}</Text>}
            {meas[0] && <Text style={styles.hint}>{t('progress.measLatest', { date: ddmm(meas[0].measured_on), n: meas.length })}</Text>}
          </CollapsibleCard>

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

          {/* DEINE KARRIERE (Lifetime-Werte + Meilensteine) */}
          {career && (career.workouts > 0 || career.foodLogs > 0) && (
            <CollapsibleCard icon="trophy" title={t('career.title')} storageKey="career" defaultCollapsed>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {[
                  { v: String(career.workouts), l: t('career.workouts') },
                  { v: `${(career.tonnageKg / 1000).toFixed(1)} t`, l: t('career.tonnage') },
                  { v: String(career.longestStreak), l: t('career.streak') },
                  { v: String(career.activeDays), l: t('career.activeDays') },
                ].map((s, i) => (
                  <View key={i} style={{ flexGrow: 1, flexBasis: '46%', backgroundColor: c.inputBg, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 }}>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: c.heading }}>{s.v}</Text>
                    <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>{s.l}</Text>
                  </View>
                ))}
              </View>
              <Text style={[styles.cardLabel, { marginTop: 16, marginBottom: 8 }]}>{t('career.milestones')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
                {milestones(career).map((m) => (
                  <View key={m.key} style={{ alignItems: 'center', width: 94, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 14, borderWidth: 1, borderColor: m.earned ? c.primary : c.border, backgroundColor: m.earned ? 'rgba(25,201,143,0.10)' : 'transparent', opacity: m.earned ? 1 : 0.55 }}>
                    <Text style={{ fontSize: 22 }}>{m.icon}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: m.earned ? c.heading : c.textMuted, textAlign: 'center', marginTop: 4 }} numberOfLines={2}>{t(`career.ms.${m.type}`, { n: m.target })}</Text>
                    {!m.earned && <Text style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>{m.value}/{m.target}</Text>}
                  </View>
                ))}
              </ScrollView>
            </CollapsibleCard>
          )}

          {/* WOCHEN-BINGO (#76c) */}
          {bingo && (
            <CollapsibleCard icon="grid" title={t('bingo.title')} storageKey="bingo">
              <Text style={{ fontSize: 13, color: c.textMuted, marginTop: 4, marginBottom: 14, lineHeight: 18 }}>{t('bingo.subtitle')}</Text>
              <WeeklyBingo cells={bingo.cells} lines={bingo.lines} full={bingo.full} />
            </CollapsibleCard>
          )}

          {/* MONATS-CHALLENGES (#3/#68) */}
          {challenges.length > 0 && (
            <CollapsibleCard icon="ribbon" title={t('challenges.title')} storageKey="challenges">
              <Text style={{ fontSize: 13, color: c.textMuted, marginTop: 4, marginBottom: 12, lineHeight: 18 }}>{t('challenges.subtitle')}</Text>
              <View style={{ gap: 14 }}>
                {challenges.map((ch) => {
                  const pct = Math.max(0, Math.min(100, Math.round((ch.value / ch.target) * 100)));
                  return (
                    <View key={ch.key}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={{ fontSize: 22 }}>{ch.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: c.heading }}>{t(`challenges.${ch.key}.name`)}</Text>
                          <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 1 }}>{t(`challenges.${ch.key}.goal`, { n: ch.target })}</Text>
                        </View>
                        {ch.done
                          ? <Ionicons name="checkmark-circle" size={24} color={c.primary} />
                          : <Text style={{ fontSize: 13, fontWeight: '800', color: c.textMuted }}>{t('challenges.progress', { value: ch.value, target: ch.target })}</Text>}
                      </View>
                      <View style={{ height: 7, borderRadius: 4, backgroundColor: c.inputBg, marginTop: 8, overflow: 'hidden' }}>
                        <View style={{ width: `${pct}%`, height: '100%', borderRadius: 4, backgroundColor: c.primary }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </CollapsibleCard>
          )}

          {/* TROPHAEEN-RAUM (Belohnung: Abzeichen-Sammlung) */}
          {trophies.length > 0 && (
            <CollapsibleCard icon="trophy" title={t('rewards.trophyTitle', { earned: trophies.filter((b) => b.earned).length, total: trophies.length })} storageKey="trophies" defaultCollapsed>
              <Text style={{ fontSize: 13, color: c.textMuted, marginTop: 4, marginBottom: 14, lineHeight: 18 }}>{t('rewards.trophySubtitle')}</Text>
              <TrophyRoom items={trophies} />
            </CollapsibleCard>
          )}

          {/* RUECKBLICK "VOR X MONATEN" (#76d) */}
          {throwback.length > 0 && (
            <CollapsibleCard icon="time" title={t('throwback.title')} storageKey="throwback">
              <Text style={{ fontSize: 13, color: c.textMuted, marginTop: 4, marginBottom: 14, lineHeight: 18 }}>{t('throwback.subtitle')}</Text>
              <ThrowbackCard items={throwback} />
            </CollapsibleCard>
          )}

          {/* FORTSCHRITTS-FOTOS (#76e) */}
          <CollapsibleCard icon="images" title={t('photos.title')} storageKey="photos" defaultCollapsed>
            <Text style={{ fontSize: 13, color: c.textMuted, marginTop: 4, marginBottom: 14, lineHeight: 18 }}>{t('photos.subtitle')}</Text>
            <ProgressPhotos focusTick={focusTick} />
          </CollapsibleCard>

          {/* MUSKEL-HEATMAP / ERHOLUNG */}
          <CollapsibleCard icon="body" title={t('progress.heatmap.title')} storageKey="heatmap" defaultCollapsed>
            {Object.keys(recovery).length === 0 ? (
              <Text style={{ fontSize: 13, color: c.textMuted, fontStyle: 'italic', marginTop: 6, lineHeight: 18 }}>{t('progress.heatmap.empty')}</Text>
            ) : (
              <>
                <Text style={{ fontSize: 13, color: c.textMuted, marginTop: 4, marginBottom: 8, lineHeight: 18 }}>{t('progress.heatmap.sub')}</Text>
                <MuscleHeatmap recovery={recovery} c={c} />
              </>
            )}
          </CollapsibleCard>

          {/* VOLUMEN JE WOCHE */}
          <CollapsibleCard icon="stats-chart" title={t('progress.weeklyVolumeTitle')} storageKey="volume" defaultCollapsed>
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
          </CollapsibleCard>

          {/* REKORDE */}
          <CollapsibleCard icon="trophy" title={t('progress.recordsTitle')} storageKey="records">
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
          </CollapsibleCard>

          {/* UEBUNGS-FORTSCHRITT */}
          {exList.length > 0 && (
            <CollapsibleCard icon="trending-up" title={t('progress.exerciseProgressTitle')} storageKey="exercises" defaultCollapsed>
              <Text style={[styles.caption, { marginTop: 0, marginBottom: 8 }]}>{t('progress.exerciseProgressCaption')}</Text>
              {exList.slice(0, 12).map((e, i) => (
                <TouchableOpacity key={e.id} style={[styles.row, i === Math.min(exList.length, 12) - 1 && styles.rowLast]} onPress={() => setSelExercise({ id: e.id, name: e.name })} activeOpacity={0.7}>
                  <Text style={styles.rowName} numberOfLines={1}>{e.name}</Text>
                  <Text style={styles.rowValue}>{e.sessions}×  ›</Text>
                </TouchableOpacity>
              ))}
            </CollapsibleCard>
          )}

          {/* HISTORIE */}
          <CollapsibleCard icon="time" title={t('progress.historyTitle')} storageKey="history" defaultCollapsed>
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
          </CollapsibleCard>
        </>
      )}
    </ScrollView>
      )}
      <Confetti fireKey={confettiKey} />
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
    projWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
    projText: { flex: 1, fontSize: 13, color: c.heading, fontWeight: '700', lineHeight: 18 },
    projRate: { color: c.textMuted, fontWeight: '700' },
    projMuted: { fontSize: 12.5, color: c.textMuted, fontStyle: 'italic', marginTop: 14, lineHeight: 17 },

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
    mGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
    mField: { flexGrow: 1, flexBasis: '28%', minWidth: 88 },
    mLabel: { fontSize: 12, color: c.textMuted, marginBottom: 4 },
    mInput: { borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, fontSize: 15, backgroundColor: c.inputBg, color: c.text },
    hint: { fontSize: 14, color: c.textMuted, lineHeight: 20, paddingVertical: 6 },

    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    rowLast: { borderBottomWidth: 0 },
    rowName: { fontSize: 15, color: c.text, flex: 1, marginRight: 10 },
    rowValue: { fontSize: 15, color: c.heading, fontWeight: '700' },
  });
}
