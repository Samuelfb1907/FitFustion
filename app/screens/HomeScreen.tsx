// Start-Screen / Dashboard (Clean Light): aufgeraeumter Ueberblick statt Kachel-Wand.
// Header (Begruessung + Level/Streak) -> Kalorien-Karte -> 3 Uebersichts-Kacheln
// (Wasser/Training/Gewicht, fuehren in ihren Bereich) -> Training-laeuft -> Tagesziele.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { computeNutrition, ageFromBirthDate, NutritionResult, Gender, ActivityLevel, GoalType } from '../lib/nutrition';
import { computeXp, levelInfo, computeStreak, ACHIEVEMENTS, GameStats } from '../lib/gamification';
import CalorieGauge from '../components/CalorieGauge';
import { dailyGoals, Goal } from '../lib/goals';
import { todayWeekday } from '../lib/weekdays';
import { localDateStr, todayStr, startOfTodayISO } from '../lib/date';
import { useFocusTick } from '../lib/useFocusTick';
import ErrorRetry from '../components/ErrorRetry';
import { errorMessage } from '../lib/errors';
import { CARD_SHADOW as shadow } from '../lib/ui';
import { WATER_GOAL } from '../lib/water';

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'Abnehmen', build_muscle: 'Muskelaufbau', gain_strength: 'Kraft steigern',
  endurance: 'Ausdauer', general_fitness: 'Allgemeine Fitness', get_defined: 'Definieren',
};

function mondayStr(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  const { session, profile } = useAuth();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nutrition, setNutrition] = useState<NutritionResult | null>(null);
  const [goalLabel, setGoalLabel] = useState('');
  const [stats, setStats] = useState<GameStats | null>(null);
  const [eaten, setEaten] = useState<Eaten>({ kcal: 0, p: 0, c: 0, f: 0 });
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [activeSets, setActiveSets] = useState(0);
  const [goalsData, setGoalsData] = useState<GoalsData | null>(null);
  const [waterMl, setWaterMl] = useState(0);
  const [planToday, setPlanToday] = useState<{ has: boolean; focus: string | null } | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(null);

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
        supabase.from('workout_sessions').select('performed_at').eq('user_id', userId),
        supabase.from('food_logs').select('log_date').eq('user_id', userId),
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
      } else {
        setError('Profildaten unvollständig.');
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
    if (error) { Alert.alert('Nicht möglich', errorMessage(error)); return; }
    setActiveSession(null);
    setActiveSets(0);
  }

  const xp = stats ? computeXp(stats) : 0;
  const lv = levelInfo(xp);
  const earnedCount = stats ? ACHIEVEMENTS.filter((a) => a.earned(stats, lv.level)).length : 0;
  const waterPct = Math.min(100, Math.round((waterMl / WATER_GOAL) * 100));

  // Training-Status fuer die Uebersichts-Kachel
  let trainVal = 'Start', trainSub = 'Freies Training';
  if (activeSession) { trainVal = 'Läuft'; trainSub = `${activeSets} ${activeSets === 1 ? 'Satz' : 'Sätze'}`; }
  else if (goalsData?.trainedToday) { trainVal = 'Erledigt'; trainSub = '✓ heute'; }
  else if (planToday?.has) { trainVal = planToday.focus ?? 'Ruhetag'; trainSub = planToday.focus ? 'laut Plan' : 'Erholung'; }

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
                <Text style={styles.name}>{profile?.first_name || 'Willkommen'}</Text>
              </View>
              {stats && (
                <View style={styles.levelPill}>
                  <Text style={styles.levelText}>🔥 {stats.streak}</Text>
                  <View style={styles.levelSep} />
                  <Text style={styles.levelText}>Lv {lv.level}</Text>
                </View>
              )}
            </View>

            {/* KALORIEN */}
            {nutrition && (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>HEUTE{goalLabel ? ` · ${goalLabel.toUpperCase()}` : ''}</Text>
                <View style={{ alignItems: 'center', marginTop: 12 }}>
                  <CalorieGauge target={nutrition.targetCalories} eaten={eaten.kcal} />
                </View>
                <View style={styles.macros}>
                  <Macro label="Protein" eaten={eaten.p} target={nutrition.proteinG} color={c.accent} styles={styles} />
                  <Macro label="Kohlenhydrate" eaten={eaten.c} target={nutrition.carbsG} color="#E69500" styles={styles} />
                  <Macro label="Fett" eaten={eaten.f} target={nutrition.fatG} color={c.danger} styles={styles} />
                </View>
              </View>
            )}

            {/* 3 UEBERSICHTS-KACHELN */}
            <View style={styles.row}>
              <Stat label="WASSER" value={`${(waterMl / 1000).toFixed(1)} L`} sub={`Ziel ${(WATER_GOAL / 1000).toFixed(1)} L`} pct={waterPct} onPress={() => onNavigate?.('essen')} styles={styles} />
              <Stat label="TRAINING" value={trainVal} sub={trainSub} onPress={() => onNavigate?.('training')} styles={styles} />
              <Stat label="GEWICHT" value={weightKg != null ? `${weightKg}` : '–'} sub={weightKg != null ? 'kg · Verlauf' : 'eintragen'} onPress={() => onNavigate?.('progress')} styles={styles} />
            </View>

            {/* TRAINING LÄUFT */}
            {activeSession && (
              <View style={styles.activeCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeTitle}>Training läuft</Text>
                  <Text style={styles.activeSub}>{activeSets} {activeSets === 1 ? 'Satz' : 'Sätze'} heute mitgeschrieben</Text>
                </View>
                <TouchableOpacity style={styles.activeBtn} onPress={endTraining} activeOpacity={0.85}>
                  <Text style={styles.activeBtnText}>Beenden</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* TAGESZIELE */}
            {nutrition && goalsData && (
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardLabel}>TAGESZIELE</Text>
                  {stats && <Text style={styles.headRight}>🏆 {earnedCount}/{ACHIEVEMENTS.length}</Text>}
                </View>
                {dailyGoals({ trainedToday: goalsData.trainedToday, trackedToday: goalsData.trackedToday, eatenKcal: eaten.kcal, targetKcal: nutrition.targetCalories, eatenProtein: eaten.p, targetProtein: nutrition.proteinG }).map((g, i, arr) => (
                  <GoalRow key={g.key} g={g} last={i === arr.length - 1} c={c} styles={styles} />
                ))}
              </View>
            )}

            {error && <Text style={styles.error}>{error}</Text>}
          </View>
        )}
      </ScrollView>
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
    <TouchableOpacity style={styles.stat} onPress={onPress} activeOpacity={0.85}>
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
    container: { flex: 1, backgroundColor: c.bg },
    scroll: { paddingTop: 60, paddingHorizontal: 18, paddingBottom: 36 },
    stack: { gap: 16 },
    row: { flexDirection: 'row', gap: 12 },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
    greet: { fontSize: 15, color: c.textMuted, fontWeight: '500' },
    name: { fontSize: 26, fontWeight: '800', color: c.heading, marginTop: 1 },
    levelPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
    levelText: { fontSize: 13, fontWeight: '700', color: c.heading },
    levelSep: { width: StyleSheet.hairlineWidth, height: 14, backgroundColor: c.border, marginHorizontal: 9 },

    // Karte
    card: { ...shadow, backgroundColor: c.card, borderRadius: 16, padding: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color: c.textMuted },
    headRight: { fontSize: 13, fontWeight: '700', color: c.textMuted },

    // Makros
    macros: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
    macro: { flex: 1, alignItems: 'center' },
    macroDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 7 },
    macroValue: { fontSize: 15, fontWeight: '700', color: c.heading },
    macroMax: { fontSize: 12, fontWeight: '600', color: c.textMuted },
    macroLabel: { fontSize: 11, color: c.textMuted, marginTop: 3, textAlign: 'center' },

    // Uebersichts-Kacheln
    stat: { ...shadow, flex: 1, backgroundColor: c.card, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, color: c.textMuted },
    statValue: { fontSize: 20, fontWeight: '800', color: c.heading, marginTop: 8 },
    statSub: { fontSize: 11, color: c.textMuted, marginTop: 2 },
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
