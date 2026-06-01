// Start-Screen / Dashboard (themed, aufgeraeumt): Hero mit Level/Streak,
// "Training laeuft"-Banner zum Beenden, Tages-Kalorien (Gauge), Schnellzugriff, Erfolge.
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'Abnehmen', build_muscle: 'Muskelaufbau', gain_strength: 'Kraft steigern',
  endurance: 'Ausdauer', general_fitness: 'Allgemeine Fitness', get_defined: 'Definieren',
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
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
const WATER_GOAL = 2500; // Tagesziel in ml

export default function HomeScreen({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { session, profile } = useAuth();
  const c = useColors();
  const styles = makeStyles(c);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    async function load() {
      const userId = session?.user?.id;
      if (!userId) return;

      const { data: prof } = await supabase
        .from('profiles').select('weight_kg, height_cm, birth_date, gender, activity_level').eq('id', userId).maybeSingle();
      setWeightKg(prof?.weight_kg != null ? Number(prof.weight_kg) : null);
      const { data: goal } = await supabase
        .from('goals').select('goal_type').eq('user_id', userId).eq('is_active', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

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

      const fdt = await supabase
        .from('food_logs').select('amount_g, foods(kcal, protein, carbs, fat)').eq('user_id', userId).eq('log_date', todayStr());
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

      // Aktives (noch nicht beendetes) Training von heute?
      const { data: act } = await supabase
        .from('workout_sessions').select('id').eq('user_id', userId).is('ended_at', null)
        .gte('performed_at', startOfTodayISO()).order('performed_at', { ascending: false }).limit(1).maybeSingle();
      setActiveSession(act?.id ?? null);
      if (act?.id) {
        const r = await supabase.from('set_logs').select('*', { count: 'exact', head: true }).eq('session_id', act.id);
        setActiveSets(r.count ?? 0);
      } else setActiveSets(0);

      const sessions = await countRows('workout_sessions', userId);
      const sets = await countRows('set_logs', userId);
      const foodLogs = await countRows('food_logs', userId);
      const { data: sd } = await supabase.from('workout_sessions').select('performed_at').eq('user_id', userId);
      const fd = await supabase.from('food_logs').select('log_date').eq('user_id', userId);
      const sdDates = ((sd ?? []) as any[]).map((r) => String(r.performed_at).slice(0, 10));
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
      const { data: schedRows } = await supabase
        .from('plan_schedule').select('weekday, workout_plan_days(focus)').eq('user_id', userId);
      if (schedRows && schedRows.length) {
        const wd = todayWeekday();
        const row = (schedRows as any[]).find((r) => r.weekday === wd);
        const day = row ? (Array.isArray(row.workout_plan_days) ? row.workout_plan_days[0] : row.workout_plan_days) : null;
        setPlanToday({ has: true, focus: day?.focus ?? null });
      } else {
        setPlanToday(null);
      }

      setLoading(false);
    }
    load();
  }, [session?.user?.id]);

  async function endTraining() {
    if (!activeSession) return;
    await supabase.from('workout_sessions').update({ ended_at: new Date().toISOString() }).eq('id', activeSession);
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
    await supabase.from('water_logs').insert({ user_id: uid, amount_ml: ml, log_date: todayStr() });
    await refreshWater();
  }
  async function undoWater() {
    if (!waterIds.length) return;
    await supabase.from('water_logs').delete().eq('id', waterIds[waterIds.length - 1]);
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
  }

  const xp = stats ? computeXp(stats) : 0;
  const lv = levelInfo(xp);
  const earnedCount = stats ? ACHIEVEMENTS.filter((a) => a.earned(stats, lv.level)).length : 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 80 }} />
        ) : (
          <>
            {/* HERO */}
            <View style={styles.hero}>
              <Text style={styles.heroHi}>Hallo, {profile?.first_name || 'willkommen'} 👋</Text>
              {stats && (
                <>
                  <View style={styles.heroChips}>
                    <View style={styles.heroChip}><Text style={styles.heroChipText}>⭐ Level {lv.level}</Text></View>
                    <View style={styles.heroChip}><Text style={styles.heroChipText}>🔥 {stats.streak} {stats.streak === 1 ? 'Tag' : 'Tage'}</Text></View>
                  </View>
                  <View style={styles.xpTrack}><View style={[styles.xpFill, { width: `${Math.round(lv.progress * 100)}%` }]} /></View>
                  <Text style={styles.xpText}>{lv.intoLevel} / {lv.perLevel} XP bis Level {lv.level + 1}</Text>
                </>
              )}
            </View>

            {/* HEUTE LAUT PLAN */}
            {planToday?.has && (
              <TouchableOpacity style={styles.planToday} onPress={() => onNavigate?.('training')} activeOpacity={0.85}>
                <Text style={styles.planTodayIcon}>{planToday.focus ? '📅' : '😌'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planTodayLabel}>Heute laut Plan</Text>
                  <Text style={styles.planTodayFocus} numberOfLines={1}>{planToday.focus ?? 'Ruhetag – Erholung'}</Text>
                </View>
                {planToday.focus && <Text style={styles.planTodayGo}>Start ›</Text>}
              </TouchableOpacity>
            )}

            {/* TRAINING LÄUFT */}
            {activeSession && (
              <View style={styles.banner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerTitle}>🏋️ Training läuft</Text>
                  <Text style={styles.bannerSub}>{activeSets} {activeSets === 1 ? 'Satz' : 'Sätze'} heute mitgeschrieben</Text>
                </View>
                <TouchableOpacity style={styles.bannerBtn} onPress={endTraining} activeOpacity={0.85}>
                  <Text style={styles.bannerBtnText}>✓ Beenden</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* HEUTE / KALORIEN */}
            {nutrition && (
              <>
                <Text style={styles.section}>HEUTE · {goalLabel}</Text>
                <View style={styles.card}>
                  <CalorieGauge target={nutrition.targetCalories} eaten={eaten.kcal} />
                  <View style={styles.macros}>
                    <Macro label="Protein" eaten={eaten.p} target={nutrition.proteinG} color={c.accent} styles={styles} />
                    <Macro label="Kohlenhydrate" eaten={eaten.c} target={nutrition.carbsG} color="#E69500" styles={styles} />
                    <Macro label="Fett" eaten={eaten.f} target={nutrition.fatG} color={c.danger} styles={styles} />
                  </View>
                </View>
                <Text style={styles.nutriNote}>{NUTRITION_DISCLAIMER}</Text>
              </>
            )}

            {/* WASSER */}
            <Text style={styles.section}>WASSER</Text>
            <View style={styles.waterCard}>
              <View style={styles.waterTop}>
                <Text style={styles.waterTitle}>💧 {waterMl} / {WATER_GOAL} ml{waterMl >= WATER_GOAL ? '  ✓' : ''}</Text>
              </View>
              <View style={styles.waterTrack}>
                <View style={[styles.waterFill, { width: `${Math.min(100, Math.round((waterMl / WATER_GOAL) * 100))}%` }]} />
              </View>
              <View style={styles.waterBtns}>
                <TouchableOpacity style={styles.waterBtn} onPress={() => addWater(250)} activeOpacity={0.8}><Text style={styles.waterBtnText}>+250 ml 🥛</Text></TouchableOpacity>
                <TouchableOpacity style={styles.waterBtn} onPress={() => addWater(500)} activeOpacity={0.8}><Text style={styles.waterBtnText}>+500 ml 🍶</Text></TouchableOpacity>
                <TouchableOpacity style={styles.waterUndo} onPress={undoWater} activeOpacity={0.8}><Text style={styles.waterUndoText}>↩</Text></TouchableOpacity>
              </View>
            </View>

            {/* GEWICHT */}
            <Text style={styles.section}>GEWICHT</Text>
            <View style={styles.waterCard}>
              <View style={styles.weightTop}>
                <Text style={styles.waterTitle}>⚖️ {weightKg != null ? `${weightKg} kg` : 'Noch kein Wert'}</Text>
                <TouchableOpacity onPress={() => onNavigate?.('progress')} activeOpacity={0.7}>
                  <Text style={styles.weightLink}>Verlauf ›</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.weightRow}>
                <TextInput
                  style={styles.weightInput}
                  value={weightInput}
                  onChangeText={setWeightInput}
                  placeholder="Heutiges Gewicht (kg)"
                  placeholderTextColor={c.textMuted}
                  keyboardType="numeric"
                />
                <TouchableOpacity style={[styles.weightBtn, savingW && { opacity: 0.6 }]} onPress={saveHomeWeight} disabled={savingW} activeOpacity={0.85}>
                  {savingW ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.weightBtnText}>Eintragen</Text>}
                </TouchableOpacity>
              </View>
              {weightMsg && <Text style={styles.weightMsg}>{weightMsg}</Text>}
            </View>

            {/* TAGESZIELE */}
            {nutrition && goalsData && (
              <>
                <Text style={styles.section}>TAGESZIELE</Text>
                <View style={styles.listCard}>
                  {dailyGoals({ trainedToday: goalsData.trainedToday, trackedToday: goalsData.trackedToday, eatenKcal: eaten.kcal, targetKcal: nutrition.targetCalories, eatenProtein: eaten.p, targetProtein: nutrition.proteinG }).map((g, i, arr) => (
                    <GoalRow key={g.key} g={g} last={i === arr.length - 1} c={c} styles={styles} />
                  ))}
                </View>
              </>
            )}

            {/* CHALLENGES */}
            {goalsData && stats && (
              <>
                <Text style={styles.section}>CHALLENGES · DIESE WOCHE</Text>
                <View style={styles.listCard}>
                  {weeklyChallenges({ sessionsThisWeek: goalsData.sessionsThisWeek, trackedDaysThisWeek: goalsData.trackedDaysThisWeek, streak: stats.streak }).map((g, i, arr) => (
                    <GoalRow key={g.key} g={g} last={i === arr.length - 1} c={c} styles={styles} />
                  ))}
                </View>
              </>
            )}

            {/* SCHNELLZUGRIFF */}
            <Text style={styles.section}>SCHNELLZUGRIFF</Text>
            <View style={styles.quick}>
              <Quick icon="🏋️" label="Training" onPress={() => onNavigate?.('training')} styles={styles} />
              <Quick icon="🍽️" label="Essen" onPress={() => onNavigate?.('essen')} styles={styles} />
              <Quick icon="📈" label="Fortschritt" onPress={() => onNavigate?.('progress')} styles={styles} />
            </View>

            {/* ERFOLGE */}
            {stats && (
              <>
                <Text style={styles.section}>ERFOLGE ({earnedCount}/{ACHIEVEMENTS.length})</Text>
                <View style={styles.badgeGrid}>
                  {ACHIEVEMENTS.map((a) => {
                    const got = a.earned(stats, lv.level);
                    return (
                      <View key={a.key} style={[styles.badge, !got && styles.badgeLocked]}>
                        <Text style={[styles.badgeIcon, !got && styles.lockedIcon]}>{got ? a.icon : '🔒'}</Text>
                        <Text style={[styles.badgeName, !got && styles.lockedName]} numberOfLines={2}>{a.name}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {error && <Text style={styles.error}>{error}</Text>}
          </>
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
      <Text style={styles.quickIcon}>{icon}</Text>
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
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 60, paddingHorizontal: 20 },

    hero: { backgroundColor: c.hero, borderRadius: 18, padding: 20, marginBottom: 14 },
    heroHi: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    heroChips: { flexDirection: 'row', gap: 8, marginTop: 12 },
    heroChip: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
    heroChipText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    xpTrack: { height: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 5, marginTop: 14, overflow: 'hidden' },
    xpFill: { height: 10, backgroundColor: '#7FA6FF', borderRadius: 5 },
    xpText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 6 },

    planToday: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    planTodayIcon: { fontSize: 24, marginRight: 12 },
    planTodayLabel: { fontSize: 12, color: c.textMuted, fontWeight: '700', letterSpacing: 0.5 },
    planTodayFocus: { fontSize: 16, fontWeight: '700', color: c.heading, marginTop: 2 },
    planTodayGo: { fontSize: 14, color: c.primary, fontWeight: '700', marginLeft: 10 },

    banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: c.accent },
    bannerTitle: { fontSize: 16, fontWeight: '700', color: c.heading },
    bannerSub: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    bannerBtn: { backgroundColor: c.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginLeft: 12 },
    bannerBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

    section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, color: c.textMuted, marginTop: 8, marginBottom: 8, marginLeft: 4 },
    nutriNote: { fontSize: 11, color: c.textMuted, lineHeight: 16, marginTop: 8, marginBottom: 2, paddingHorizontal: 2 },

    card: { backgroundColor: c.card, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    macros: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 18 },
    macro: { flex: 1, alignItems: 'center' },
    macroDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
    macroValue: { fontSize: 15, fontWeight: '700', color: c.text },
    macroLabel: { fontSize: 12, color: c.textMuted, marginTop: 2, textAlign: 'center' },

    waterCard: { backgroundColor: c.card, borderRadius: 16, padding: 16, marginBottom: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    waterTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    waterTitle: { fontSize: 16, fontWeight: '700', color: c.heading },
    waterTrack: { height: 10, backgroundColor: c.track, borderRadius: 5, overflow: 'hidden', marginTop: 10 },
    waterFill: { height: 10, backgroundColor: c.primary, borderRadius: 5 },
    waterBtns: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' },
    waterBtn: { flex: 1, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
    waterBtnText: { color: c.primary, fontWeight: '700', fontSize: 14 },
    waterUndo: { width: 46, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
    waterUndoText: { color: c.textMuted, fontSize: 16, fontWeight: '700' },

    weightTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    weightLink: { color: c.primary, fontSize: 13, fontWeight: '600' },
    weightRow: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' },
    weightInput: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, backgroundColor: c.inputBg, color: c.text },
    weightBtn: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    weightBtnText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
    weightMsg: { fontSize: 13, color: c.success, marginTop: 8 },

    listCard: { backgroundColor: c.card, borderRadius: 16, paddingHorizontal: 16, marginBottom: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    goalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    goalRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    goalIcon: { fontSize: 20, marginRight: 12 },
    goalLabel: { fontSize: 15, fontWeight: '600', color: c.text },
    goalTrack: { height: 6, backgroundColor: c.track, borderRadius: 3, marginTop: 6, overflow: 'hidden' },
    goalFill: { height: 6, borderRadius: 3 },
    goalDetail: { fontSize: 12, color: c.textMuted, marginTop: 4 },
    goalCheck: { fontSize: 20, fontWeight: '700', marginLeft: 10 },

    quick: { flexDirection: 'row', gap: 10, marginBottom: 6 },
    quickCard: { flex: 1, backgroundColor: c.card, borderRadius: 14, paddingVertical: 18, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    quickIcon: { fontSize: 24 },
    quickLabel: { fontSize: 12, color: c.heading, marginTop: 6, fontWeight: '600' },

    badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    badge: { width: '31%', backgroundColor: c.card, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center', marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    badgeLocked: { backgroundColor: c.bg },
    badgeIcon: { fontSize: 26 },
    lockedIcon: { opacity: 0.6 },
    badgeName: { fontSize: 11, color: c.text, textAlign: 'center', marginTop: 6, fontWeight: '600' },
    lockedName: { color: c.textMuted, fontWeight: '400' },

    error: { color: c.danger, fontSize: 14, marginTop: 16, textAlign: 'center' },
  });
}
