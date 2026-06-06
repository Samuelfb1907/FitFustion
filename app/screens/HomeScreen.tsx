// Start-Screen / Dashboard im Bento-Grid-Stil: Begruessungs-Kachel, Mini-KPI-Kacheln,
// grosse Feature-Kacheln (Kalorien/Wasser/Gewicht), Schnellzugriff & Erfolge.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { computeNutrition, ageFromBirthDate, NutritionResult, Gender, ActivityLevel, GoalType } from '../lib/nutrition';
import { computeXp, levelInfo, computeStreak, ACHIEVEMENTS, GameStats } from '../lib/gamification';
import CalorieGauge from '../components/CalorieGauge';
import { dailyGoals, weeklyChallenges, Goal } from '../lib/goals';
import { saveTodayWeight, parseWeight, WEIGHT_MIN, WEIGHT_MAX } from '../lib/weight';
import { todayWeekday } from '../lib/weekdays';
import { NUTRITION_DISCLAIMER } from '../lib/legal';
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

// todayStr & startOfTodayISO -> lib/date.ts
function mondayStr(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Montag dieser Woche
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type GoalsData = { trainedToday: boolean; trackedToday: boolean; sessionsThisWeek: number; trackedDaysThisWeek: number };
async function countRows(table: string, userId: string): Promise<number> {
  const res = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId);
  return res.error ? 0 : res.count ?? 0;
}

type Eaten = { kcal: number; p: number; c: number; f: number };
// WATER_GOAL -> lib/water.ts

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
  const [waterIds, setWaterIds] = useState<string[]>([]);
  const [planToday, setPlanToday] = useState<{ has: boolean; focus: string | null } | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [savingW, setSavingW] = useState(false);
  const [weightMsg, setWeightMsg] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
      const userId = session?.user?.id;
      if (!userId) return;
      if (!silent) setLoading(true);

      try {
      // unabhängige Abfragen parallel (statt nacheinander) -> deutlich schnellerer Aufbau
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

      // Heutiges Training laut Wochenplan
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
  // Start-Reiter erneut angetippt -> leise neu laden (ohne Spinner)
  useFocusTick(focusTick, () => { load(true); });

  const onRefresh = useCallback(() => { setRefreshing(true); load(true); }, [load]);

  async function endTraining() {
    if (!activeSession) return;
    const { error } = await supabase.from('workout_sessions').update({ ended_at: new Date().toISOString() }).eq('id', activeSession);
    if (error) { Alert.alert('Nicht möglich', errorMessage(error)); return; }
    setActiveSession(null);
    setActiveSets(0);
  }

  async function refreshWater() {
    const uid = session?.user?.id;
    if (!uid) return;
    const { data } = await supabase.from('water_logs').select('id, amount_ml').eq('user_id', uid).eq('log_date', todayStr()).order('created_at');
    const rows = (data ?? []) as any[];
    setWaterMl(rows.reduce((s, r) => s + (r.amount_ml ?? 0), 0));
    setWaterIds(rows.map((r) => r.id));
  }
  async function addWater(ml: number) {
    const uid = session?.user?.id;
    if (!uid) return;
    const { error } = await supabase.from('water_logs').insert({ user_id: uid, amount_ml: ml, log_date: todayStr() });
    if (error) { Alert.alert('Nicht gespeichert', errorMessage(error)); return; }
    await refreshWater();
  }
  async function undoWater() {
    if (!waterIds.length) return;
    const { error } = await supabase.from('water_logs').delete().eq('id', waterIds[waterIds.length - 1]);
    if (error) { Alert.alert('Nicht möglich', errorMessage(error)); return; }
    await refreshWater();
  }

  async function saveHomeWeight() {
    const uid = session?.user?.id;
    if (!uid) return;
    const w = parseWeight(weightInput);
    if (w == null) { setWeightMsg(`Bitte ${WEIGHT_MIN}–${WEIGHT_MAX} kg eingeben.`); return; }
    setSavingW(true);
    setWeightMsg(null);
    const err = await saveTodayWeight(uid, w);
    setSavingW(false);
    if (err) { setWeightMsg('Speichern fehlgeschlagen.'); return; }
    setWeightKg(w);
    setWeightInput('');
    setWeightMsg('Gespeichert ✓');
    setTimeout(() => setWeightMsg(null), 2500);
  }

  const xp = stats ? computeXp(stats) : 0;
  const lv = levelInfo(xp);
  const earnedCount = stats ? ACHIEVEMENTS.filter((a) => a.earned(stats, lv.level)).length : 0;
  const waterPct = Math.min(100, Math.round((waterMl / WATER_GOAL) * 100));

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
          <View style={styles.grid}>
            {/* BEGRUESSUNG */}
            <View style={styles.heroTile}>
              <Text style={styles.heroHi}>{greeting()},</Text>
              <Text style={styles.heroName}>{profile?.first_name || 'willkommen'} 👋</Text>
              {stats && (
                <>
                  <View style={styles.xpTrack}><View style={[styles.xpFill, { width: `${Math.round(lv.progress * 100)}%` }]} /></View>
                  <Text style={styles.xpText}>Level {lv.level} · {lv.intoLevel}/{lv.perLevel} XP bis Level {lv.level + 1}</Text>
                </>
              )}
            </View>

            {/* MINI-KPI-KACHELN */}
            {stats && (
              <View style={styles.row}>
                <View style={styles.mini}>
                  <Text style={styles.miniIcon}>🔥</Text>
                  <Text style={styles.miniValue}>{stats.streak}</Text>
                  <Text style={styles.miniLabel}>{stats.streak === 1 ? 'Tag' : 'Tage'} Streak</Text>
                </View>
                <View style={styles.mini}>
                  <Text style={styles.miniIcon}>⭐</Text>
                  <Text style={styles.miniValue}>{lv.level}</Text>
                  <Text style={styles.miniLabel}>Level</Text>
                </View>
                <View style={styles.mini}>
                  <Text style={styles.miniIcon}>🏋️</Text>
                  <Text style={styles.miniValue}>{stats.sessions}</Text>
                  <Text style={styles.miniLabel}>Trainings</Text>
                </View>
              </View>
            )}

            {/* HEUTE LAUT PLAN */}
            {planToday?.has && (
              <TouchableOpacity style={styles.tileRow} onPress={() => onNavigate?.('training')} activeOpacity={0.85}>
                <Text style={styles.tileRowIcon}>{planToday.focus ? '📅' : '😌'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tileLabel}>HEUTE LAUT PLAN</Text>
                  <Text style={styles.tileRowValue} numberOfLines={1}>{planToday.focus ?? 'Ruhetag – Erholung'}</Text>
                </View>
                {planToday.focus && <Text style={styles.tileGo}>Start ›</Text>}
              </TouchableOpacity>
            )}

            {/* TRAINING LÄUFT */}
            {activeSession && (
              <View style={styles.activeTile}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeTitle}>🏋️ Training läuft</Text>
                  <Text style={styles.activeSub}>{activeSets} {activeSets === 1 ? 'Satz' : 'Sätze'} heute mitgeschrieben</Text>
                </View>
                <TouchableOpacity style={styles.activeBtn} onPress={endTraining} activeOpacity={0.85}>
                  <Text style={styles.activeBtnText}>✓ Beenden</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* KALORIEN */}
            {nutrition && (
              <View style={styles.tile}>
                <Text style={styles.tileLabel}>HEUTE · {goalLabel.toUpperCase()}</Text>
                <View style={{ alignItems: 'center', marginTop: 8 }}>
                  <CalorieGauge target={nutrition.targetCalories} eaten={eaten.kcal} />
                </View>
                <View style={styles.macros}>
                  <Macro label="Protein" eaten={eaten.p} target={nutrition.proteinG} color={c.accent} styles={styles} />
                  <Macro label="Kohlenhydrate" eaten={eaten.c} target={nutrition.carbsG} color="#F59E0B" styles={styles} />
                  <Macro label="Fett" eaten={eaten.f} target={nutrition.fatG} color={c.danger} styles={styles} />
                </View>
                <Text style={styles.nutriNote}>{NUTRITION_DISCLAIMER}</Text>
              </View>
            )}

            {/* WASSER */}
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>💧 WASSER</Text>
              <Text style={styles.bigStat}>{waterMl}<Text style={styles.bigStatUnit}> / {WATER_GOAL} ml{waterMl >= WATER_GOAL ? '  ✓' : ''}</Text></Text>
              <View style={styles.bar}><View style={[styles.barFill, { width: `${waterPct}%` }]} /></View>
              <View style={styles.waterBtns}>
                <TouchableOpacity style={styles.pill} onPress={() => addWater(250)} activeOpacity={0.8}><Text style={styles.pillText}>+250 ml 💧</Text></TouchableOpacity>
                <TouchableOpacity style={styles.pill} onPress={() => addWater(500)} activeOpacity={0.8}><Text style={styles.pillText}>+500 ml 💦</Text></TouchableOpacity>
                <TouchableOpacity style={styles.pillGhost} onPress={undoWater} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Letzten Wasser-Eintrag rückgängig"><Text style={styles.pillGhostText}>↩</Text></TouchableOpacity>
              </View>
            </View>

            {/* GEWICHT */}
            <View style={styles.tile}>
              <View style={styles.tileHead}>
                <Text style={styles.tileLabel}>⚖️ GEWICHT</Text>
                <TouchableOpacity onPress={() => onNavigate?.('progress')} activeOpacity={0.7}><Text style={styles.tileGo}>Verlauf ›</Text></TouchableOpacity>
              </View>
              <Text style={styles.bigStat}>{weightKg != null ? `${weightKg} kg` : 'Noch kein Wert'}</Text>
              <View style={styles.weightRow}>
                <TextInput
                  style={styles.input}
                  value={weightInput}
                  onChangeText={setWeightInput}
                  placeholder="Heutiges Gewicht (kg)"
                  placeholderTextColor={c.textMuted}
                  keyboardType="numeric"
                  underlineColorAndroid="transparent"
                />
                <TouchableOpacity style={[styles.solidBtn, savingW && { opacity: 0.6 }]} onPress={saveHomeWeight} disabled={savingW} activeOpacity={0.85}>
                  {savingW ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.solidBtnText}>Eintragen</Text>}
                </TouchableOpacity>
              </View>
              {weightMsg && <Text style={styles.weightMsg}>{weightMsg}</Text>}
            </View>

            {/* TAGESZIELE */}
            {nutrition && goalsData && (
              <View style={styles.tile}>
                <Text style={[styles.tileLabel, { marginBottom: 4 }]}>TAGESZIELE</Text>
                {dailyGoals({ trainedToday: goalsData.trainedToday, trackedToday: goalsData.trackedToday, eatenKcal: eaten.kcal, targetKcal: nutrition.targetCalories, eatenProtein: eaten.p, targetProtein: nutrition.proteinG }).map((g, i, arr) => (
                  <GoalRow key={g.key} g={g} last={i === arr.length - 1} c={c} styles={styles} />
                ))}
              </View>
            )}

            {/* CHALLENGES */}
            {goalsData && stats && (
              <View style={styles.tile}>
                <Text style={[styles.tileLabel, { marginBottom: 4 }]}>CHALLENGES · DIESE WOCHE</Text>
                {weeklyChallenges({ sessionsThisWeek: goalsData.sessionsThisWeek, trackedDaysThisWeek: goalsData.trackedDaysThisWeek, streak: stats.streak }).map((g, i, arr) => (
                  <GoalRow key={g.key} g={g} last={i === arr.length - 1} c={c} styles={styles} />
                ))}
              </View>
            )}

            {/* SCHNELLZUGRIFF */}
            <View style={styles.row}>
              <Quick icon="🏋️" label="Training" onPress={() => onNavigate?.('training')} styles={styles} />
              <Quick icon="🍽️" label="Essen" onPress={() => onNavigate?.('essen')} styles={styles} />
              <Quick icon="📈" label="Fortschritt" onPress={() => onNavigate?.('progress')} styles={styles} />
            </View>

            {/* ERFOLGE */}
            {stats && (
              <View style={styles.tile}>
                <Text style={[styles.tileLabel, { marginBottom: 4 }]}>ERFOLGE ({earnedCount}/{ACHIEVEMENTS.length})</Text>
                <View style={styles.badgeGrid}>
                  {ACHIEVEMENTS.map((a) => {
                    const got = a.earned(stats, lv.level);
                    return (
                      <TouchableOpacity
                        key={a.key}
                        style={[styles.badge, !got && styles.badgeLocked]}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${a.name}${got ? ', freigeschaltet' : ', gesperrt'}`}
                        onPress={() => Alert.alert(`${a.icon} ${a.name}`, (got ? '✓ Freigeschaltet\n\n' : '🔒 Noch gesperrt\n\n') + (a.description ?? ''))}
                      >
                        <Text style={[styles.badgeIcon, !got && styles.lockedIcon]}>{got ? a.icon : '🔒'}</Text>
                        <Text style={[styles.badgeName, !got && styles.lockedName]} numberOfLines={2}>{a.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
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
      <Text style={styles.macroValue}>{eaten} / {target} g</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

function Quick({ icon, label, onPress, styles }: { icon: string; label: string; onPress: () => void; styles: any }) {
  return (
    <TouchableOpacity style={styles.quickCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.quickIconWrap}><Text style={styles.quickIcon}>{icon}</Text></View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function GoalRow({ g, last, c, styles }: { g: Goal; last: boolean; c: Colors; styles: any }) {
  return (
    <View style={[styles.goalRow, !last && styles.goalRowBorder]}>
      <Text style={styles.goalIcon}>{g.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.goalLabel}>{g.label}</Text>
        <View style={styles.goalTrack}>
          <View style={[styles.goalFill, { width: `${Math.round(g.progress * 100)}%`, backgroundColor: g.done ? c.success : c.primary }]} />
        </View>
        <Text style={styles.goalDetail}>{g.detail}</Text>
      </View>
      <Text style={[styles.goalCheck, { color: g.done ? c.success : c.textMuted }]}>{g.done ? '✓' : '○'}</Text>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scroll: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 40 },
    grid: { gap: 12 },
    row: { flexDirection: 'row', gap: 12 },

    // Begruessungs-Kachel (Hero)
    heroTile: { backgroundColor: c.hero, borderRadius: 24, padding: 22, shadowColor: c.hero, shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 7 },
    heroHi: { color: 'rgba(255,255,255,0.82)', fontSize: 16, fontWeight: '600' },
    heroName: { color: '#fff', fontSize: 27, fontWeight: '800', marginTop: 2 },
    xpTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 4, marginTop: 18, overflow: 'hidden' },
    xpFill: { height: 8, backgroundColor: '#A5B4FC', borderRadius: 4 },
    xpText: { color: 'rgba(255,255,255,0.82)', fontSize: 12, marginTop: 8 },

    // Mini-KPI-Kacheln
    mini: { ...shadow, flex: 1, backgroundColor: c.card, borderRadius: 22, paddingVertical: 16, paddingHorizontal: 10, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    miniIcon: { fontSize: 20 },
    miniValue: { fontSize: 25, fontWeight: '800', color: c.heading, marginTop: 4 },
    miniLabel: { fontSize: 11, color: c.textMuted, marginTop: 2, textAlign: 'center' },

    // Allgemeine grosse Kachel
    tile: { ...shadow, backgroundColor: c.card, borderRadius: 24, padding: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    tileHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    tileLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: c.textMuted },
    tileGo: { fontSize: 13, color: c.primary, fontWeight: '700' },

    bigStat: { fontSize: 30, fontWeight: '800', color: c.heading, marginTop: 8 },
    bigStatUnit: { fontSize: 16, fontWeight: '700', color: c.textMuted },
    bar: { height: 10, backgroundColor: c.track, borderRadius: 5, overflow: 'hidden', marginTop: 14 },
    barFill: { height: 10, backgroundColor: c.primary, borderRadius: 5 },

    // Plan-heute Kachel (Zeile)
    tileRow: { ...shadow, flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 24, padding: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    tileRowIcon: { fontSize: 26, marginRight: 14 },
    tileRowValue: { fontSize: 16, fontWeight: '700', color: c.heading, marginTop: 3 },

    // Training-laeuft Kachel
    activeTile: { ...shadow, flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 24, padding: 18, borderWidth: 1.5, borderColor: c.accent },
    activeTitle: { fontSize: 16, fontWeight: '700', color: c.heading },
    activeSub: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    activeBtn: { backgroundColor: c.accent, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11, marginLeft: 12 },
    activeBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

    // Wasser-Buttons
    waterBtns: { flexDirection: 'row', gap: 10, marginTop: 14, alignItems: 'center' },
    pill: { flex: 1, backgroundColor: c.inputBg, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
    pillText: { color: c.primary, fontWeight: '700', fontSize: 14 },
    pillGhost: { width: 50, borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: c.border },
    pillGhostText: { color: c.textMuted, fontSize: 16, fontWeight: '700' },

    // Gewicht-Eingabe
    weightRow: { flexDirection: 'row', gap: 10, marginTop: 14, alignItems: 'center' },
    input: { flex: 1, backgroundColor: c.inputBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: c.text, borderWidth: 1, borderColor: c.border },
    solidBtn: { backgroundColor: c.primary, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
    solidBtnText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
    weightMsg: { fontSize: 13, color: c.success, marginTop: 10 },

    // Kalorien-Makros
    macros: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 18 },
    macro: { flex: 1, alignItems: 'center' },
    macroDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
    macroValue: { fontSize: 15, fontWeight: '700', color: c.text },
    macroLabel: { fontSize: 12, color: c.textMuted, marginTop: 2, textAlign: 'center' },
    nutriNote: { fontSize: 11, color: c.textMuted, lineHeight: 16, marginTop: 14 },

    // Ziele/Challenges-Zeilen
    goalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    goalRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    goalIcon: { fontSize: 20, marginRight: 12 },
    goalLabel: { fontSize: 15, fontWeight: '600', color: c.text },
    goalTrack: { height: 6, backgroundColor: c.track, borderRadius: 3, marginTop: 6, overflow: 'hidden' },
    goalFill: { height: 6, borderRadius: 3 },
    goalDetail: { fontSize: 12, color: c.textMuted, marginTop: 4 },
    goalCheck: { fontSize: 20, fontWeight: '700', marginLeft: 10 },

    // Schnellzugriff-Kacheln
    quickCard: { ...shadow, flex: 1, backgroundColor: c.card, borderRadius: 22, paddingVertical: 18, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    quickIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.inputBg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    quickIcon: { fontSize: 24 },
    quickLabel: { fontSize: 12, color: c.heading, fontWeight: '700' },

    // Erfolge
    badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10 },
    badge: { width: '31%', backgroundColor: c.inputBg, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center', marginBottom: 10 },
    badgeLocked: { opacity: 0.55 },
    badgeIcon: { fontSize: 26 },
    lockedIcon: { opacity: 0.6 },
    badgeName: { fontSize: 11, color: c.text, textAlign: 'center', marginTop: 6, fontWeight: '600' },
    lockedName: { color: c.textMuted, fontWeight: '400' },

    error: { color: c.danger, fontSize: 14, marginTop: 8, textAlign: 'center' },
  });
}
