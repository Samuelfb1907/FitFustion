// Start-Screen / Dashboard (Clean Light): aufgeraeumter Ueberblick statt Kachel-Wand.
// Header (Begruessung + Level/Streak) -> Kalorien-Karte -> 3 Uebersichts-Kacheln
// (Wasser/Training/Gewicht, fuehren in ihren Bereich) -> Training-laeuft -> Tagesziele.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../contexts/LanguageContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { computeNutrition, ageFromBirthDate, NutritionResult, Gender, ActivityLevel, GoalType } from '../lib/nutrition';
import { computeXp, levelInfo, computeStreak, ACHIEVEMENTS, GameStats } from '../lib/gamification';
import CalorieGauge from '../components/CalorieGauge';
import GlassFill from '../components/GlassFill';
import { usePaywall } from '../components/Paywall';
import { todayTrainingKcal } from '../lib/trainingBonus';
import { hasStepsPermission, getTodayActivity } from '../lib/health';
import { dailyGoals, Goal } from '../lib/goals';
import { todayWeekday } from '../lib/weekdays';
import { localDateStr, todayStr, startOfTodayISO, daysAgoStr, daysAgoISO, mondayStr } from '../lib/date';
import { useFocusTick } from '../lib/useFocusTick';
import ErrorRetry from '../components/ErrorRetry';
import { errorMessage } from '../lib/errors';
import { CARD_SHADOW as shadow } from '../lib/ui';
import { WATER_GOAL } from '../lib/water';

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'Abnehmen', build_muscle: 'Muskelaufbau', gain_strength: 'Kraft steigern',
  endurance: 'Ausdauer', general_fitness: 'Allgemeine Fitness', get_defined: 'Definieren',
};

type GoalsData = { trainedToday: boolean; trackedToday: boolean; sessionsThisWeek: number; trackedDaysThisWeek: number };
async function countRows(table: string, userId: string): Promise<number> {
  const res = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId);
  return res.error ? 0 : res.count ?? 0;
}

type Eaten = { kcal: number; p: number; c: number; f: number };

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export default function HomeScreen({ onNavigate, focusTick }: { onNavigate?: (tab: string) => void; focusTick?: number }) {
  const { session, profile, isPremium } = useAuth();
  const { openPaywall } = usePaywall();
  const t = useT();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nutrition, setNutrition] = useState<NutritionResult | null>(null);
  const [goalLabel, setGoalLabel] = useState('');
  const [stats, setStats] = useState<GameStats | null>(null);
  const [achOpen, setAchOpen] = useState(false);
  const [eaten, setEaten] = useState<Eaten>({ kcal: 0, p: 0, c: 0, f: 0 });
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [activeSets, setActiveSets] = useState(0);
  const [goalsData, setGoalsData] = useState<GoalsData | null>(null);
  const [waterMl, setWaterMl] = useState(0);
  const [planToday, setPlanToday] = useState<{ has: boolean; focus: string | null } | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [trainingKcal, setTrainingKcal] = useState(0);
  const [steps, setSteps] = useState(0);
  const [activityKcal, setActivityKcal] = useState(0);
  const [activityMeasured, setActivityMeasured] = useState(false);

  const load = useCallback(async (silent = false) => {
      const userId = session?.user?.id;
      if (!userId) return;
      if (!silent) setLoading(true);

      try {
      const [profRes, goalRes, fdt, actRes, sessions, sets, foodLogs, sdRes, fd, schedRes] = await Promise.all([
        supabase.from('profiles').select('weight_kg, height_cm, birth_date, gender, activity_level').eq('id', userId).maybeSingle(),
        supabase.from('goals').select('goal_type').eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('food_logs').select('amount_g, foods(kcal, protein, carbs, fat)').eq('user_id', userId).eq('log_date', todayStr()),
        supabase.from('workout_sessions').select('id').eq('user_id', userId).is('ended_at', null).gte('performed_at', startOfTodayISO()).order('performed_at', { ascending: false }).limit(1).maybeSingle(),
        countRows('workout_sessions', userId),
        countRows('set_logs', userId),
        countRows('food_logs', userId),
        supabase.from('workout_sessions').select('performed_at').eq('user_id', userId).gte('performed_at', daysAgoISO(400)),
        supabase.from('food_logs').select('log_date').eq('user_id', userId).gte('log_date', daysAgoStr(400)),
        supabase.from('plan_schedule').select('weekday, workout_plan_days(focus)').eq('user_id', userId),
      ]);

      const prof = profRes.data;
      const goal = goalRes.data;
      setWeightKg(prof?.weight_kg != null ? Number(prof.weight_kg) : null);
      if (prof && prof.weight_kg && prof.height_cm) {
        const goalType = (goal?.goal_type ?? 'general_fitness') as GoalType;
        setNutrition(
          computeNutrition({
            weightKg: Number(prof.weight_kg), heightCm: Number(prof.height_cm), age: ageFromBirthDate(prof.birth_date),
            gender: (prof.gender ?? 'prefer_not') as Gender, activity: (prof.activity_level ?? 'moderate') as ActivityLevel, goal: goalType,
          })
        );
        setGoalLabel(GOAL_LABELS[goalType] ?? goalType);
        setTrainingKcal(await todayTrainingKcal(userId, Number(prof.weight_kg)));
        if (await hasStepsPermission()) {
          const a = await getTodayActivity(Number(prof.weight_kg));
          setSteps(a.steps); setActivityKcal(a.kcal); setActivityMeasured(a.measured);
        } else { setSteps(0); setActivityKcal(0); setActivityMeasured(false); }
      } else {
        setError(t('home.profileIncomplete'));
      }

      const e: Eaten = { kcal: 0, p: 0, c: 0, f: 0 };
      if (!fdt.error && fdt.data) {
        for (const row of fdt.data as any[]) {
          const food = Array.isArray(row.foods) ? row.foods[0] : row.foods;
          if (!food) continue;
          const factor = (row.amount_g ?? 0) / 100;
          e.kcal += (food.kcal ?? 0) * factor; e.p += (food.protein ?? 0) * factor;
          e.c += (food.carbs ?? 0) * factor; e.f += (food.fat ?? 0) * factor;
        }
      }
      setEaten({ kcal: Math.round(e.kcal), p: Math.round(e.p), c: Math.round(e.c), f: Math.round(e.f) });

      await refreshWater();

      const act = actRes.data;
      setActiveSession(act?.id ?? null);
      if (act?.id) {
        const r = await supabase.from('set_logs').select('*', { count: 'exact', head: true }).eq('session_id', act.id);
        setActiveSets(r.count ?? 0);
      } else setActiveSets(0);

      const sd = sdRes.data;
      const sdDates = ((sd ?? []) as any[]).map((r) => localDateStr(r.performed_at));
      const fdDates = fd.error ? [] : ((fd.data ?? []) as any[]).map((r) => String(r.log_date).slice(0, 10));
      const dates = [...sdDates, ...fdDates];
      setStats({ sessions, sets, foodLogs, streak: computeStreak(dates), goalSet: !!goal });
      const today = todayStr(), mon = mondayStr();
      setGoalsData({
        trainedToday: sdDates.includes(today),
        trackedToday: fdDates.includes(today),
        sessionsThisWeek: new Set(sdDates.filter((x) => x >= mon)).size,
        trackedDaysThisWeek: new Set(fdDates.filter((x) => x >= mon)).size,
      });

      const schedRows = schedRes.data;
      if (schedRows && schedRows.length) {
        const wd = todayWeekday();
        const row = (schedRows as any[]).find((r) => r.weekday === wd);
        const day = row ? (Array.isArray(row.workout_plan_days) ? row.workout_plan_days[0] : row.workout_plan_days) : null;
        setPlanToday({ has: true, focus: day?.focus ?? null });
      } else {
        setPlanToday(null);
      }

      setLoadError(null);
      } catch (e) {
        setLoadError(errorMessage(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
  }, [session?.user?.id]);

  useEffect(() => { load(); }, [load]);
  useFocusTick(focusTick, () => { load(true); });

  const onRefresh = useCallback(() => { setRefreshing(true); load(true); }, [load]);

  async function refreshWater() {
    const uid = session?.user?.id;
    if (!uid) return;
    const { data } = await supabase.from('water_logs').select('id, amount_ml').eq('user_id', uid).eq('log_date', todayStr()).order('created_at');
    const rows = (data ?? []) as any[];
    setWaterMl(rows.reduce((s, r) => s + (r.amount_ml ?? 0), 0));
  }

  async function endTraining() {
    if (!activeSession) return;
    const { error } = await supabase.from('workout_sessions').update({ ended_at: new Date().toISOString() }).eq('id', activeSession);
    if (error) { Alert.alert(t('home.endTrainingFailedTitle'), errorMessage(error)); return; }
    setActiveSession(null);
    setActiveSets(0);
  }

  const xp = stats ? computeXp(stats) : 0;
  const lv = levelInfo(xp);
  const earnedCount = stats ? ACHIEVEMENTS.filter((a) => a.earned(stats, lv.level)).length : 0;
  const waterPct = Math.min(100, Math.round((waterMl / WATER_GOAL) * 100));

  // Training-Status fuer die Uebersichts-Kachel
  let trainVal = t('home.trainStart'), trainSub = t('home.trainFree');
  if (activeSession) { trainVal = t('home.trainRunning'); trainSub = `${activeSets} ${activeSets === 1 ? t('home.setSingular') : t('home.setPlural')}`; }
  else if (goalsData?.trainedToday) { trainVal = t('home.trainDone'); trainSub = t('home.trainDoneToday'); }
  else if (planToday?.has) { trainVal = planToday.focus ?? t('home.trainRestDay'); trainSub = planToday.focus ? t('home.trainPerPlan') : t('home.trainRecovery'); }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 80 }} />
        ) : loadError ? (
          <ErrorRetry message={loadError} onRetry={() => load()} />
        ) : (
          <View style={styles.stack}>
            {/* HEADER */}
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.greet}>{greeting()},</Text>
                <Text style={styles.name}>{profile?.first_name || t('home.welcome')}</Text>
              </View>
              {stats && (
                <TouchableOpacity style={styles.levelPill} activeOpacity={isPremium ? 1 : 0.7} disabled={isPremium} onPress={() => openPaywall('level')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={isPremium ? t('home.levelStreakA11y', { level: lv.level, streak: stats.streak }) : t('home.unlockToLevelA11y')}>
                  <GlassFill radius={999} />
                  <Text style={styles.levelText}>🔥 {stats.streak}</Text>
                  <View style={styles.levelSep} />
                  <Text style={styles.levelText}>{isPremium ? `Lv ${lv.level}` : t('home.levelLocked')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* KALORIEN */}
            {nutrition && (
              <View style={styles.card}>
                <GlassFill radius={16} />
                <Text style={styles.cardLabel}>{t('home.todayLabel')}{goalLabel ? ` · ${goalLabel.toUpperCase()}` : ''}</Text>
                <View style={{ alignItems: 'center', marginTop: 12 }}>
                  <CalorieGauge target={nutrition.targetCalories + Math.max(trainingKcal, activityKcal)} eaten={eaten.kcal} />
                </View>
                {trainingKcal > 0 && activityKcal === 0 && <Text style={styles.bonusLine}>{t('home.bonusTraining', { n: trainingKcal })}</Text>}
                {activityKcal > 0 && <Text style={styles.bonusLine}>🚶 {steps > 0 ? t('home.stepsPrefix', { steps: steps.toLocaleString('de-DE') }) : ''}+{activityKcal} kcal {activityMeasured ? t('home.activeMeasured') : t('home.activeEstimated')}</Text>}
                <View style={styles.macros}>
                  <Macro label={t('home.macroProtein')} eaten={eaten.p} target={nutrition.proteinG} color={c.accent} styles={styles} />
                  <Macro label={t('home.macroCarbs')} eaten={eaten.c} target={nutrition.carbsG} color="#E69500" styles={styles} />
                  <Macro label={t('home.macroFat')} eaten={eaten.f} target={nutrition.fatG} color={c.danger} styles={styles} />
                </View>
              </View>
            )}

            {/* 3 UEBERSICHTS-KACHELN */}
            <View style={styles.row}>
              <Stat label={t('home.tileWater')} value={`${(waterMl / 1000).toFixed(1)} L`} sub={t('home.waterGoal', { n: (WATER_GOAL / 1000).toFixed(1) })} pct={waterPct} onPress={() => onNavigate?.('essen')} styles={styles} />
              <Stat label={t('home.tileTraining')} value={trainVal} sub={trainSub} onPress={() => onNavigate?.('training')} styles={styles} />
              <Stat label={t('home.tileWeight')} value={weightKg != null ? `${weightKg}` : '–'} sub={weightKg != null ? t('home.weightSubHistory') : t('home.weightSubAdd')} onPress={() => onNavigate?.('progress')} styles={styles} />
            </View>

            {/* TRAINING LÄUFT */}
            {activeSession && (
              <View style={styles.activeCard}>
                <GlassFill radius={16} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeTitle}>{t('home.activeTitle')}</Text>
                  <Text style={styles.activeSub}>{t('home.activeSub', { n: activeSets, sets: activeSets === 1 ? t('home.setSingular') : t('home.setPlural') })}</Text>
                </View>
                <TouchableOpacity style={styles.activeBtn} onPress={endTraining} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('home.endTrainingA11y')}>
                  <Text style={styles.activeBtnText}>{t('home.endTraining')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* TAGESZIELE */}
            {nutrition && goalsData && (
              <View style={styles.card}>
                <GlassFill radius={16} />
                <View style={styles.cardHead}>
                  <Text style={styles.cardLabel}>{t('home.dailyGoals')}</Text>
                  {stats && (
                    <TouchableOpacity onPress={() => setAchOpen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('home.viewAchievementsA11y', { n: earnedCount, m: ACHIEVEMENTS.length })}>
                      <Text style={styles.headRight}>🏆 {earnedCount}/{ACHIEVEMENTS.length} ›</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {dailyGoals({ trainedToday: goalsData.trainedToday, trackedToday: goalsData.trackedToday, eatenKcal: eaten.kcal, targetKcal: nutrition.targetCalories + Math.max(trainingKcal, activityKcal), eatenProtein: eaten.p, targetProtein: nutrition.proteinG }).map((g, i, arr) => (
                  <GoalRow key={g.key} g={g} last={i === arr.length - 1} c={c} styles={styles} />
                ))}
              </View>
            )}

            {error && <Text style={styles.error}>{error}</Text>}
          </View>
        )}
      </ScrollView>

      <Modal visible={achOpen} animationType="slide" transparent onRequestClose={() => setAchOpen(false)}>
        <View style={styles.achBackdrop}>
          <View style={styles.achSheet}>
            <View style={styles.achHead}>
              <Text style={styles.achTitle}>{t('home.achievementsTitle')}</Text>
              <Text style={styles.achCount}>🏆 {earnedCount}/{ACHIEVEMENTS.length}</Text>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
              {ACHIEVEMENTS.map((a) => {
                const earned = !!stats && a.earned(stats, lv.level);
                return (
                  <View key={a.key} style={[styles.achRow, !earned && styles.achRowLocked]} accessible accessibilityLabel={`${a.name}, ${a.description} ${earned ? t('home.achievementUnlocked') : t('home.achievementLocked')}`}>
                    <Text style={styles.achIcon}>{earned ? a.icon : '🔒'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.achName}>{a.name}</Text>
                      <Text style={styles.achDesc}>{a.description}</Text>
                    </View>
                    {earned && <Text style={styles.achTick}>✓</Text>}
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.achClose} onPress={() => setAchOpen(false)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('home.closeAchievementsA11y')}>
              <Text style={styles.achCloseText}>{t('home.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Macro({ label, eaten, target, color, styles }: { label: string; eaten: number; target: number; color: string; styles: any }) {
  return (
    <View style={styles.macro}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <Text style={styles.macroValue}>{eaten}<Text style={styles.macroMax}> / {target} g</Text></Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

function Stat({ label, value, sub, pct, onPress, styles }: { label: string; value: string; sub: string; pct?: number; onPress: () => void; styles: any }) {
  return (
    <TouchableOpacity style={styles.stat} onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`${label}: ${value}, ${sub}`}>
      <GlassFill radius={16} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statSub} numberOfLines={1}>{sub}</Text>
      {pct != null && <View style={styles.statBar}><View style={[styles.statFill, { width: `${pct}%` }]} /></View>}
    </TouchableOpacity>
  );
}

function GoalRow({ g, last, c, styles }: { g: Goal; last: boolean; c: Colors; styles: any }) {
  return (
    <View style={[styles.goalRow, !last && styles.goalRowBorder]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.goalLabel}>{g.label}</Text>
        <View style={styles.goalTrack}>
          <View style={[styles.goalFill, { width: `${Math.round(g.progress * 100)}%`, backgroundColor: g.done ? c.success : c.primary }]} />
        </View>
      </View>
      <Text style={[styles.goalCheck, { color: g.done ? c.success : c.textMuted }]}>{g.done ? '✓' : '○'}</Text>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    scroll: { paddingTop: 60, paddingHorizontal: 18, paddingBottom: 36 },
    stack: { gap: 16 },
    row: { flexDirection: 'row', gap: 12 },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
    greet: { fontSize: 15, color: c.textMuted, fontWeight: '500' },
    name: { fontSize: 26, fontWeight: '800', color: c.heading, marginTop: 1 },
    levelPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
    levelText: { fontSize: 13, fontWeight: '700', color: c.heading },
    levelSep: { width: StyleSheet.hairlineWidth, height: 14, backgroundColor: c.border, marginHorizontal: 9 },

    // Karte
    card: { ...shadow, backgroundColor: c.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: c.cardBorder },
    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color: c.textMuted },
    bonusLine: { fontSize: 12, fontWeight: '700', color: c.primary, textAlign: 'center', marginTop: 10 },
    headRight: { fontSize: 13, fontWeight: '700', color: c.textMuted },
    achBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    achSheet: { backgroundColor: c.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 24, maxHeight: '82%' },
    achHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    achTitle: { fontSize: 20, fontWeight: '800', color: c.heading },
    achCount: { fontSize: 14, fontWeight: '700', color: c.primary },
    achRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: c.cardBorder },
    achRowLocked: { opacity: 0.55 },
    achIcon: { fontSize: 26, marginRight: 14 },
    achName: { fontSize: 15, fontWeight: '700', color: c.heading },
    achDesc: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    achTick: { fontSize: 18, fontWeight: '800', color: c.success, marginLeft: 10 },
    achClose: { marginTop: 10, backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    achCloseText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },

    // Makros
    macros: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
    macro: { flex: 1, alignItems: 'center' },
    macroDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 7 },
    macroValue: { fontSize: 15, fontWeight: '700', color: c.heading },
    macroMax: { fontSize: 12, fontWeight: '600', color: c.textMuted },
    macroLabel: { fontSize: 12, color: c.textMuted, marginTop: 3, textAlign: 'center' },

    // Uebersichts-Kacheln
    stat: { ...shadow, flex: 1, backgroundColor: c.card, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 12, borderWidth: 1, borderColor: c.cardBorder },
    statLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color: c.textMuted },
    statValue: { fontSize: 20, fontWeight: '800', color: c.heading, marginTop: 8 },
    statSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    statBar: { height: 5, backgroundColor: c.track, borderRadius: 3, overflow: 'hidden', marginTop: 10 },
    statFill: { height: 5, backgroundColor: c.primary, borderRadius: 3 },

    // Training laeuft
    activeCard: { ...shadow, flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: c.primary },
    activeTitle: { fontSize: 16, fontWeight: '700', color: c.heading },
    activeSub: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    activeBtn: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginLeft: 12 },
    activeBtnText: { color: c.onPrimary, fontSize: 14, fontWeight: '700' },

    // Tagesziele
    goalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
    goalRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    goalLabel: { fontSize: 14, fontWeight: '600', color: c.text },
    goalTrack: { height: 5, backgroundColor: c.track, borderRadius: 3, marginTop: 8, overflow: 'hidden' },
    goalFill: { height: 5, borderRadius: 3 },
    goalCheck: { fontSize: 18, fontWeight: '700', marginLeft: 14 },

    error: { color: c.danger, fontSize: 14, marginTop: 8, textAlign: 'center' },
  });
}
