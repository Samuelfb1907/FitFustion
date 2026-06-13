// Start-Screen / Dashboard (Clean Light): aufgeraeumter Ueberblick statt Kachel-Wand.
// Header (Begruessung + Level/Streak) -> Kalorien-Karte -> 3 Uebersichts-Kacheln
// (Wasser/Training/Gewicht, fuehren in ihren Bereich) -> Training-laeuft -> Tagesziele.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, PanResponder, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useT, useLang } from '../contexts/LanguageContext';
import { useColors, useTheme, Colors } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
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
  lose_weight: 'home.goal.lose_weight', build_muscle: 'home.goal.build_muscle', gain_strength: 'home.goal.gain_strength',
  endurance: 'home.goal.endurance', general_fitness: 'home.goal.general_fitness', get_defined: 'home.goal.get_defined',
};

// Wochentage/Monate fuer die Datumszeile im Header (bewusst ohne Intl - deterministisch).
const WEEKDAYS = {
  de: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
const MONTHS = {
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
// Kurze Wochentage fuer die Tages-Navigation der Kalorien-Karte (z. B. "MO, 09.06").
const WEEKDAYS_SHORT = {
  de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};
const DAYS_BACK = 6; // wie viele Tage zurueck wischbar (0..6 = 7 Tage inkl. heute)
// Icons je Tagesziel (Schluessel aus lib/goals.ts).
const GOAL_ICONS: Record<string, string> = { train: 'barbell-outline', track: 'restaurant-outline', kcal: 'flame-outline', protein: 'egg-outline' };

type GoalsData = { trainedToday: boolean; trackedToday: boolean; sessionsThisWeek: number; trackedDaysThisWeek: number };
async function countRows(table: string, userId: string): Promise<number> {
  const res = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId);
  return res.error ? 0 : res.count ?? 0;
}

type Eaten = { kcal: number; p: number; c: number; f: number };

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'home.greeting.morning';
  if (h < 18) return 'home.greeting.day';
  return 'home.greeting.evening';
}

export default function HomeScreen({ onNavigate, focusTick }: { onNavigate?: (tab: string) => void; focusTick?: number }) {
  const { session, profile, isPremium } = useAuth();
  const { openPaywall } = usePaywall();
  const t = useT();
  const c = useColors();
  const { theme } = useTheme();
  const { lang } = useLang();
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
  const [days, setDays] = useState<Eaten[]>([]); // gegessen je Tag, Index = Tage zurueck (0 = heute)
  const [dayOffset, setDayOffset] = useState(0); // welcher Tag auf der Kalorien-Karte gerade gezeigt wird
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [activeSets, setActiveSets] = useState(0);
  const [goalsData, setGoalsData] = useState<GoalsData | null>(null);
  const [waterMl, setWaterMl] = useState(0);
  const [waterBusy, setWaterBusy] = useState(false);
  const [waterJust, setWaterJust] = useState(false);
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
        supabase.from('food_logs').select('amount_g, log_date, foods(kcal, protein, carbs, fat)').eq('user_id', userId).gte('log_date', daysAgoStr(DAYS_BACK)),
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

      // Gegessen je Kalendertag buendeln (7 Tage), damit man auf der Karte zurueckwischen kann.
      const empty = (): Eaten => ({ kcal: 0, p: 0, c: 0, f: 0 });
      const buckets: Record<string, Eaten> = {};
      if (!fdt.error && fdt.data) {
        for (const row of fdt.data as any[]) {
          const food = Array.isArray(row.foods) ? row.foods[0] : row.foods;
          if (!food) continue;
          const key = String(row.log_date).slice(0, 10);
          const b = (buckets[key] ??= empty());
          const factor = (row.amount_g ?? 0) / 100;
          b.kcal += (food.kcal ?? 0) * factor; b.p += (food.protein ?? 0) * factor;
          b.c += (food.carbs ?? 0) * factor; b.f += (food.fat ?? 0) * factor;
        }
      }
      const round = (b: Eaten): Eaten => ({ kcal: Math.round(b.kcal), p: Math.round(b.p), c: Math.round(b.c), f: Math.round(b.f) });
      const dayArr: Eaten[] = [];
      for (let off = 0; off <= DAYS_BACK; off++) {
        const b = buckets[daysAgoStr(off)];
        dayArr.push(b ? round(b) : empty());
      }
      setDays(dayArr);
      setEaten(dayArr[0]); // heute – fuer Tagesziele/Bonus unten

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

  // Ein-Tipp-Wasser: ein Glas (0,25 L) direkt vom Home-Screen eintragen.
  async function quickAddWater() {
    const uid = session?.user?.id;
    if (!uid || waterBusy) return;
    setWaterBusy(true);
    try {
      const { error: e } = await supabase.from('water_logs').insert({ user_id: uid, amount_ml: 250, log_date: todayStr() });
      if (!e) {
        setWaterMl((v) => v + 250);
        setWaterJust(true);
        setTimeout(() => setWaterJust(false), 1800);
      }
    } finally {
      setWaterBusy(false);
    }
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
  const dark = theme === 'dark';
  const amber = dark ? '#FFB454' : '#B07A10';
  const now = new Date();
  const dateLine = lang === 'en'
    ? `${WEEKDAYS.en[now.getDay()]}, ${MONTHS.en[now.getMonth()]} ${now.getDate()}`
    : `${WEEKDAYS.de[now.getDay()]}, ${now.getDate()}. ${MONTHS.de[now.getMonth()]}`;
  const litres = (waterMl / 1000).toFixed(1).replace('.', lang === 'en' ? '.' : ',');

  // Training-Status fuer die Uebersichts-Kachel
  let trainVal = t('home.trainStart'), trainSub = t('home.trainFree');
  if (activeSession) { trainVal = t('home.trainRunning'); trainSub = `${activeSets} ${activeSets === 1 ? t('home.setSingular') : t('home.setPlural')}`; }
  else if (goalsData?.trainedToday) { trainVal = t('home.trainDone'); trainSub = t('home.trainDoneToday'); }
  else if (planToday?.has) { trainVal = planToday.focus ? t(planToday.focus) : t('home.trainRestDay'); trainSub = planToday.focus ? t('home.trainPerPlan') : t('home.trainRecovery'); }

  // Tage-Navigation der Kalorien-Karte: nach RECHTS wischen (links -> rechts) = ein Tag
  // zurueck, nach LINKS = wieder vor. Die GANZE Karte ist wischbar; dragX laesst den Inhalt
  // dem Finger leicht folgen (weiches Feedback), niedrige Schwelle = leicht auszuloesen.
  const cur = days[dayOffset] ?? eaten;
  const goOlder = useCallback(() => setDayOffset((o) => Math.min(DAYS_BACK, o + 1)), []);
  const goNewer = useCallback(() => setDayOffset((o) => Math.max(0, o - 1)), []);
  const fade = useRef(new Animated.Value(1)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fade.setValue(0.5);
    Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [dayOffset]);
  const snapBack = () => Animated.spring(dragX, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 6 }).start();
  const pan = useRef(
    PanResponder.create({
      // Sobald die Bewegung eher waagerecht als senkrecht ist, uebernehmen wir die Geste
      // (sonst bleibt das vertikale Scrollen beim ScrollView).
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => dragX.setValue(Math.max(-70, Math.min(70, g.dx * 0.6))),
      onPanResponderRelease: (_, g) => {
        if (g.dx > 35 || g.vx > 0.2) goOlder();        // links -> rechts: ein Tag zurueck
        else if (g.dx < -35 || g.vx < -0.2) goNewer(); // rechts -> links: ein Tag vor
        snapBack();
      },
      onPanResponderTerminate: snapBack,
    })
  ).current;
  const dayLabel = (off: number): string => {
    if (off === 0) return t('home.day.today');
    if (off === 1) return t('home.day.yesterday');
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - off);
    const wd = (lang === 'en' ? WEEKDAYS_SHORT.en : WEEKDAYS_SHORT.de)[d.getDay()];
    return `${wd}, ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

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
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.greet}>{t(greeting())},</Text>
                <Text style={styles.name} numberOfLines={1}>{profile?.first_name || t('home.welcome')}</Text>
                <Text style={styles.date} numberOfLines={1}>{dateLine}</Text>
              </View>
              {stats && (
                <View style={styles.pillRow}>
                  <View style={styles.pill} accessible accessibilityLabel={t('home.streakA11y', { streak: stats.streak })}>
                    <GlassFill radius={999} />
                    <Ionicons name="flame" size={13} color={amber} />
                    <Text style={[styles.pillText, { color: amber }]} numberOfLines={1}>{stats.streak}</Text>
                  </View>
                  <TouchableOpacity style={styles.pill} activeOpacity={isPremium ? 1 : 0.7} disabled={isPremium} onPress={() => openPaywall('level')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={isPremium ? t('home.levelStreakA11y', { level: lv.level, streak: stats.streak }) : t('home.unlockToLevelA11y')}>
                    <GlassFill radius={999} />
                    <Ionicons name={isPremium ? 'star' : 'lock-closed'} size={13} color={c.primary} />
                    <Text style={[styles.pillText, { color: c.primary }]} numberOfLines={1}>{isPremium ? `Lv ${lv.level}` : t('home.levelLocked')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* KALORIEN – ganze Karte wischbar; nach rechts wischen blaettert bis zu 7 Tage zurueck */}
            {nutrition && (
              <View style={styles.card} {...pan.panHandlers}>
                <GlassFill radius={22} />
                <Animated.View style={{ opacity: fade, transform: [{ translateX: dragX }] }}>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardLabel}>{dayLabel(dayOffset).toLocaleUpperCase(lang === 'en' ? 'en-US' : 'de-DE')}</Text>
                    {dayOffset === 0 ? (
                      !!goalLabel && (
                        <View style={styles.goalBadge}>
                          <Text style={styles.goalBadgeText} numberOfLines={1}>{t(goalLabel).toUpperCase()}</Text>
                        </View>
                      )
                    ) : (
                      <TouchableOpacity style={styles.todayPill} onPress={() => setDayOffset(0)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('home.day.todayA11y')}>
                        <Ionicons name="today-outline" size={13} color={c.primary} />
                        <Text style={styles.todayPillText} numberOfLines={1}>{t('home.day.today')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={{ alignItems: 'center', marginTop: 16 }}>
                    <CalorieGauge target={nutrition.targetCalories + (dayOffset === 0 ? Math.max(trainingKcal, activityKcal) : 0)} eaten={cur.kcal} />
                  </View>
                  {dayOffset === 0 && trainingKcal > 0 && activityKcal === 0 && (
                    <View style={styles.bonusPill}>
                      <Ionicons name="flame" size={14} color={c.primary} />
                      <Text style={styles.bonusText} numberOfLines={1}>{t('home.bonusTraining', { n: trainingKcal })}</Text>
                    </View>
                  )}
                  {dayOffset === 0 && activityKcal > 0 && (
                    <View style={styles.bonusPill}>
                      <Ionicons name="walk" size={14} color={c.primary} />
                      <Text style={styles.bonusText} numberOfLines={1}>{steps > 0 ? t('home.stepsPrefix', { steps: steps.toLocaleString(lang === 'en' ? 'en-US' : 'de-DE') }) : ''}+{activityKcal} kcal {activityMeasured ? t('home.activeMeasured') : t('home.activeEstimated')}</Text>
                    </View>
                  )}
                  {dayOffset > 0 && cur.kcal === 0 && (
                    <Text style={styles.untracked}>{t('home.day.untracked')}</Text>
                  )}
                  <View style={styles.macros}>
                    <Macro label={t('home.macroProtein')} eaten={cur.p} target={nutrition.proteinG} color={c.primary} styles={styles} />
                    <Macro label={t('home.macroCarbs')} eaten={cur.c} target={nutrition.carbsG} color="#E69500" styles={styles} />
                    <Macro label={t('home.macroFat')} eaten={cur.f} target={nutrition.fatG} color={c.danger} styles={styles} />
                  </View>
                </Animated.View>
                {/* Tage-Navigation: links = aelter, rechts = neuer; Punkt rechts = heute */}
                <View style={styles.dayNav}>
                  <TouchableOpacity style={styles.dayNavBtn} onPress={goOlder} disabled={dayOffset >= DAYS_BACK} hitSlop={{ top: 10, bottom: 10, left: 12, right: 6 }} accessibilityRole="button" accessibilityLabel={t('home.day.olderA11y')}>
                    <Ionicons name="chevron-back" size={18} color={c.primary} style={dayOffset >= DAYS_BACK ? { opacity: 0.3 } : undefined} />
                  </TouchableOpacity>
                  <View style={styles.dots}>
                    {[6, 5, 4, 3, 2, 1, 0].map((off) => (
                      <View key={off} style={[styles.dot, off === dayOffset && styles.dotActive]} />
                    ))}
                  </View>
                  <TouchableOpacity style={styles.dayNavBtn} onPress={goNewer} disabled={dayOffset <= 0} hitSlop={{ top: 10, bottom: 10, left: 6, right: 12 }} accessibilityRole="button" accessibilityLabel={t('home.day.newerA11y')}>
                    <Ionicons name="chevron-forward" size={18} color={c.primary} style={dayOffset <= 0 ? { opacity: 0.3 } : undefined} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 3 UEBERSICHTS-KACHELN */}
            <View style={styles.row}>
              <Stat
                a11y={`${t('home.tileWater')}: ${litres} L, ${t('home.waterGoal', { n: (WATER_GOAL / 1000).toFixed(1) })}`}
                value={`${litres} L`}
                sub={waterJust ? t('home.waterAdded') : t('home.waterGoal', { n: (WATER_GOAL / 1000).toFixed(1) })}
                pct={waterPct} barColor="#3FA9F5"
                icon="water" tint={{ fg: '#3FA9F5', bg: 'rgba(63,169,245,0.14)' }}
                onPress={() => onNavigate?.('essen')} styles={styles}
                quick={{ onPress: quickAddWater, busy: waterBusy, done: waterJust, a11y: t('home.waterQuickA11y') }}
              />
              <Stat
                a11y={`${t('home.tileTraining')}: ${trainVal}, ${trainSub}`}
                value={trainVal} sub={trainSub}
                icon="barbell" tint={{ fg: c.primary, bg: dark ? 'rgba(25,201,143,0.14)' : 'rgba(14,159,110,0.12)' }}
                onPress={() => onNavigate?.('training')} styles={styles}
              />
              <Stat
                a11y={`${t('home.tileWeight')}: ${weightKg != null ? weightKg : '–'}, ${weightKg != null ? t('home.weightSubHistory') : t('home.weightSubAdd')}`}
                value={weightKg != null ? `${weightKg}` : '–'} sub={weightKg != null ? t('home.weightSubHistory') : t('home.weightSubAdd')}
                icon="scale" tint={{ fg: dark ? '#C3A8FF' : '#7C5CD6', bg: 'rgba(157,123,244,0.14)' }}
                onPress={() => onNavigate?.('progress')} styles={styles}
              />
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
                <GlassFill radius={22} />
                <View style={styles.cardHead}>
                  <Text style={styles.cardLabel}>{t('home.dailyGoals')}</Text>
                  {stats && (
                    <TouchableOpacity style={styles.trophyRow} onPress={() => setAchOpen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('home.viewAchievementsA11y', { n: earnedCount, m: ACHIEVEMENTS.length })}>
                      <Ionicons name="trophy" size={14} color={amber} />
                      <Text style={[styles.headRight, { color: amber }]} numberOfLines={1}>{earnedCount}/{ACHIEVEMENTS.length} ›</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {stats && (
                  <View style={styles.achBar}>
                    <View style={[styles.achBarFill, { width: `${Math.round((earnedCount / ACHIEVEMENTS.length) * 100)}%`, backgroundColor: amber }]} />
                  </View>
                )}
                {dailyGoals({ trainedToday: goalsData.trainedToday, trackedToday: goalsData.trackedToday, eatenKcal: eaten.kcal, targetKcal: nutrition.targetCalories + Math.max(trainingKcal, activityKcal), eatenProtein: eaten.p, targetProtein: nutrition.proteinG }).map((g, i, arr) => (
                  <GoalRow key={g.key} g={g} last={i === arr.length - 1} c={c} styles={styles} t={t} />
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="trophy" size={15} color={c.primary} />
                <Text style={styles.achCount}>{earnedCount}/{ACHIEVEMENTS.length}</Text>
              </View>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
              {ACHIEVEMENTS.map((a) => {
                const earned = !!stats && a.earned(stats, lv.level);
                return (
                  <View key={a.key} style={[styles.achRow, !earned && styles.achRowLocked]} accessible accessibilityLabel={`${a.name}, ${a.description} ${earned ? t('home.achievementUnlocked') : t('home.achievementLocked')}`}>
                    {earned ? <Text style={styles.achIcon}>{a.icon}</Text> : <View style={styles.achIconLock}><Ionicons name="lock-closed" size={22} color={c.textMuted} /></View>}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.achName}>{a.name}</Text>
                      <Text style={styles.achDesc}>{a.description}</Text>
                    </View>
                    {earned && <Ionicons name="checkmark-circle" size={20} color={c.primary} style={{ marginLeft: 10 }} />}
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

// Makro-Spalte: Wort OBEN, Zahl darunter (bricht nie um), Fortschrittsbalken.
function Macro({ label, eaten, target, color, styles }: { label: string; eaten: number; target: number; color: string; styles: any }) {
  const pct = target > 0 ? Math.min(100, Math.round((eaten / target) * 100)) : 0;
  return (
    <View style={styles.macro}>
      <Text style={styles.macroLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.macroValue} numberOfLines={1}>{eaten}<Text style={styles.macroMax}> / {target} g</Text></Text>
      <View style={styles.macroTrack}><View style={[styles.macroFill, { width: `${pct}%`, backgroundColor: color }]} /></View>
    </View>
  );
}

// Uebersichts-Kachel mit Icon-Chip; optionaler Schnell-Knopf (z. B. +1 Glas Wasser).
function Stat({ a11y, value, sub, pct, barColor, icon, tint, onPress, styles, quick }: {
  a11y: string; value: string; sub: string; pct?: number; barColor?: string; icon: string;
  tint: { fg: string; bg: string }; onPress: () => void; styles: any;
  quick?: { onPress: () => void; busy: boolean; done: boolean; a11y: string };
}) {
  return (
    <TouchableOpacity style={styles.stat} onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={a11y}>
      <GlassFill radius={20} />
      <View style={styles.statTop}>
        <View style={[styles.statChip, { backgroundColor: tint.bg }]}>
          <Ionicons name={icon as any} size={19} color={tint.fg} />
        </View>
        {quick && (
          <TouchableOpacity style={[styles.quickBtn, { backgroundColor: tint.fg, opacity: quick.busy ? 0.6 : 1 }]} onPress={quick.onPress} disabled={quick.busy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={quick.a11y}>
            <Ionicons name={quick.done ? 'checkmark' : 'add'} size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statSub} numberOfLines={1}>{sub}</Text>
      {pct != null && <View style={styles.statBar}><View style={[styles.statFill, { width: `${pct}%`, backgroundColor: barColor }]} /></View>}
    </TouchableOpacity>
  );
}

// Tagesziel-Zeile: Icon + Text + Haken (erledigt hell, offen gedimmt).
function GoalRow({ g, last, c, styles, t }: { g: Goal; last: boolean; c: Colors; styles: any; t: (k: string, p?: Record<string, string | number>) => string }) {
  return (
    <View style={[styles.goalRow, !last && styles.goalRowBorder]}>
      <Ionicons name={(GOAL_ICONS[g.key] ?? 'ellipse-outline') as any} size={17} color={g.done ? c.primary : c.textMuted} />
      <Text style={[styles.goalLabel, { color: g.done ? c.heading : c.textMuted }]} numberOfLines={1}>{t(g.label)}</Text>
      <Ionicons name={g.done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={g.done ? c.primary : c.textMuted} style={g.done ? undefined : { opacity: 0.45 }} />
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    scroll: { paddingTop: 60, paddingHorizontal: 18, paddingBottom: 36 },
    stack: { gap: 14 },
    row: { flexDirection: 'row', gap: 11 },

    // Header
    header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
    greet: { fontSize: 14, color: c.textMuted, fontWeight: '500' },
    name: { fontSize: 28, fontWeight: '800', color: c.primary, marginTop: 2, letterSpacing: -0.5 },
    date: { fontSize: 12, color: c.textMuted, fontWeight: '500', marginTop: 8 },
    pillRow: { flexDirection: 'row', gap: 7, marginTop: 2 },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, overflow: 'hidden' },
    pillText: { fontSize: 13, fontWeight: '700' },

    // Karte
    card: { ...shadow, backgroundColor: c.card, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.8, color: c.textMuted },
    goalBadge: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(22,180,134,0.30)', backgroundColor: 'rgba(22,180,134,0.10)' },
    goalBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: c.primary },
    todayPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(22,180,134,0.30)', backgroundColor: 'rgba(22,180,134,0.10)' },
    todayPillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: c.primary },
    untracked: { textAlign: 'center', marginTop: 12, fontSize: 12, fontWeight: '600', color: c.textMuted },
    dayNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 16 },
    dayNavBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.track },
    dotActive: { width: 18, backgroundColor: c.primary },
    bonusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 14, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(22,180,134,0.25)', backgroundColor: 'rgba(22,180,134,0.10)' },
    bonusText: { fontSize: 12, fontWeight: '600', color: c.primary },
    headRight: { fontSize: 13, fontWeight: '700', color: c.textMuted },
    trophyRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    achBar: { height: 4, borderRadius: 3, backgroundColor: c.track, overflow: 'hidden', marginTop: 12, marginBottom: 4 },
    achBarFill: { height: 4, borderRadius: 3 },
    achBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    achSheet: { backgroundColor: c.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 24, maxHeight: '82%' },
    achHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    achTitle: { fontSize: 20, fontWeight: '800', color: c.heading },
    achCount: { fontSize: 14, fontWeight: '700', color: c.primary },
    achRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: c.cardBorder },
    achRowLocked: { opacity: 0.55 },
    achIcon: { fontSize: 26, marginRight: 14 },
    achIconLock: { width: 26, marginRight: 14, alignItems: 'center' },
    achName: { fontSize: 15, fontWeight: '700', color: c.heading },
    achDesc: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    achTick: { fontSize: 18, fontWeight: '800', color: c.success, marginLeft: 10 },
    achClose: { marginTop: 10, backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    achCloseText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },

    // Makros (Wort oben, Zahl darunter, Balken - bricht nie um)
    macros: { flexDirection: 'row', gap: 14, marginTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, paddingTop: 16 },
    macro: { flex: 1, minWidth: 0 },
    macroLabel: { fontSize: 11, fontWeight: '600', color: c.textMuted, marginBottom: 8 },
    macroValue: { fontSize: 16, fontWeight: '800', color: c.heading },
    macroMax: { fontSize: 11, fontWeight: '500', color: c.textMuted },
    macroTrack: { height: 6, borderRadius: 4, backgroundColor: c.track, overflow: 'hidden', marginTop: 10 },
    macroFill: { height: 6, borderRadius: 4 },

    // Uebersichts-Kacheln (Icon-Chip + Wert + Unterzeile)
    stat: { ...shadow, flex: 1, backgroundColor: c.card, borderRadius: 20, paddingVertical: 15, paddingHorizontal: 13, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    statTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    statChip: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    quickBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    statValue: { fontSize: 21, fontWeight: '800', color: c.heading, marginTop: 14, letterSpacing: -0.3 },
    statSub: { fontSize: 11, color: c.textMuted, fontWeight: '500', marginTop: 7 },
    statBar: { height: 5, backgroundColor: c.track, borderRadius: 3, overflow: 'hidden', marginTop: 11 },
    statFill: { height: 5, borderRadius: 3 },

    // Training laeuft
    activeCard: { ...shadow, flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: c.primary },
    activeTitle: { fontSize: 16, fontWeight: '700', color: c.heading },
    activeSub: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    activeBtn: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginLeft: 12 },
    activeBtnText: { color: c.onPrimary, fontSize: 14, fontWeight: '700' },

    // Tagesziele (Icon + Text + Haken)
    goalRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12 },
    goalRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    goalLabel: { flex: 1, fontSize: 14, fontWeight: '600' },

    error: { color: c.danger, fontSize: 14, marginTop: 8, textAlign: 'center' },
  });
}
