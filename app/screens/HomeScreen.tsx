// Start-Screen / Dashboard: Level & XP, Streak, Kalorien-Gauge (gegessen vs. übrig), Erfolge.
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { computeNutrition, ageFromBirthDate, NutritionResult, Gender, ActivityLevel, GoalType } from '../lib/nutrition';
import { computeXp, levelInfo, computeStreak, ACHIEVEMENTS, GameStats } from '../lib/gamification';
import CalorieGauge from '../components/CalorieGauge';

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'Abnehmen',
  build_muscle: 'Muskelaufbau',
  gain_strength: 'Kraft steigern',
  endurance: 'Ausdauer',
  general_fitness: 'Allgemeine Fitness',
  get_defined: 'Definieren',
};

function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

async function countRows(table: string, userId: string): Promise<number> {
  const res = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId);
  return res.error ? 0 : res.count ?? 0;
}

type Eaten = { kcal: number; p: number; c: number; f: number };

export default function HomeScreen() {
  const { session, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nutrition, setNutrition] = useState<NutritionResult | null>(null);
  const [goalLabel, setGoalLabel] = useState('');
  const [stats, setStats] = useState<GameStats | null>(null);
  const [eaten, setEaten] = useState<Eaten>({ kcal: 0, p: 0, c: 0, f: 0 });

  useEffect(() => {
    async function load() {
      const userId = session?.user?.id;
      if (!userId) return;

      const { data: prof } = await supabase
        .from('profiles')
        .select('weight_kg, height_cm, birth_date, gender, activity_level')
        .eq('id', userId)
        .maybeSingle();
      const { data: goal } = await supabase
        .from('goals')
        .select('goal_type')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prof && prof.weight_kg && prof.height_cm) {
        const goalType = (goal?.goal_type ?? 'general_fitness') as GoalType;
        setNutrition(
          computeNutrition({
            weightKg: Number(prof.weight_kg),
            heightCm: Number(prof.height_cm),
            age: ageFromBirthDate(prof.birth_date),
            gender: (prof.gender ?? 'prefer_not') as Gender,
            activity: (prof.activity_level ?? 'moderate') as ActivityLevel,
            goal: goalType,
          })
        );
        setGoalLabel(GOAL_LABELS[goalType] ?? goalType);
      } else {
        setError('Profildaten unvollständig.');
      }

      // Heute gegessen (aus dem Tracker)
      const fdt = await supabase
        .from('food_logs')
        .select('amount_g, foods(kcal, protein, carbs, fat)')
        .eq('user_id', userId)
        .eq('log_date', todayStr());
      const e: Eaten = { kcal: 0, p: 0, c: 0, f: 0 };
      if (!fdt.error && fdt.data) {
        for (const row of fdt.data as any[]) {
          const food = Array.isArray(row.foods) ? row.foods[0] : row.foods;
          if (!food) continue;
          const factor = (row.amount_g ?? 0) / 100;
          e.kcal += (food.kcal ?? 0) * factor;
          e.p += (food.protein ?? 0) * factor;
          e.c += (food.carbs ?? 0) * factor;
          e.f += (food.fat ?? 0) * factor;
        }
      }
      setEaten({ kcal: Math.round(e.kcal), p: Math.round(e.p), c: Math.round(e.c), f: Math.round(e.f) });

      // Aktivität für Gamification
      const sessions = await countRows('workout_sessions', userId);
      const sets = await countRows('set_logs', userId);
      const foodLogs = await countRows('food_logs', userId);
      const { data: sd } = await supabase.from('workout_sessions').select('performed_at').eq('user_id', userId);
      const fd = await supabase.from('food_logs').select('log_date').eq('user_id', userId);
      const dates = [
        ...((sd ?? []) as any[]).map((r) => String(r.performed_at).slice(0, 10)),
        ...(fd.error ? [] : ((fd.data ?? []) as any[]).map((r) => String(r.log_date).slice(0, 10))),
      ];
      setStats({ sessions, sets, foodLogs, streak: computeStreak(dates), goalSet: !!goal });
      setLoading(false);
    }
    load();
  }, [session?.user?.id]);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  const xp = stats ? computeXp(stats) : 0;
  const lv = levelInfo(xp);
  const earnedCount = stats ? ACHIEVEMENTS.filter((a) => a.earned(stats, lv.level)).length : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Hallo, {profile?.first_name || 'willkommen'}! 👋</Text>
          <Text style={styles.email}>{session?.user.email}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#1F3864" style={{ marginTop: 40 }} />
        ) : (
          <>
            {stats && (
              <View style={styles.levelCard}>
                <View style={styles.levelTop}>
                  <Text style={styles.levelText}>Level {lv.level}</Text>
                  <View style={styles.streakChip}>
                    <Text style={styles.streakText}>🔥 {stats.streak} {stats.streak === 1 ? 'Tag' : 'Tage'}</Text>
                  </View>
                </View>
                <View style={styles.xpTrack}>
                  <View style={[styles.xpFill, { width: `${Math.round(lv.progress * 100)}%` }]} />
                </View>
                <Text style={styles.xpText}>{lv.intoLevel} / {lv.perLevel} XP bis Level {lv.level + 1}</Text>
              </View>
            )}

            {nutrition && (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>HEUTE · {goalLabel}</Text>
                <CalorieGauge target={nutrition.targetCalories} eaten={eaten.kcal} />
                <View style={styles.macros}>
                  <Macro label="Protein" eaten={eaten.p} target={nutrition.proteinG} color="#2E7D32" />
                  <Macro label="Kohlenhydrate" eaten={eaten.c} target={nutrition.carbsG} color="#E69500" />
                  <Macro label="Fett" eaten={eaten.f} target={nutrition.fatG} color="#C62828" />
                </View>
              </View>
            )}

            {stats && (
              <View style={styles.achSection}>
                <Text style={styles.achTitle}>Erfolge ({earnedCount}/{ACHIEVEMENTS.length})</Text>
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
              </View>
            )}

            {error && <Text style={styles.error}>{error}</Text>}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Macro({ label, eaten, target, color }: { label: string; eaten: number; target: number; color: string }) {
  return (
    <View style={styles.macro}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <Text style={styles.macroValue}>{eaten} / {target} g</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F5FA', paddingTop: 60, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  hello: { fontSize: 24, fontWeight: 'bold', color: '#1F3864' },
  email: { fontSize: 13, color: '#777', marginTop: 2 },
  logoutBtn: { borderWidth: 1, borderColor: '#CFD8E3', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' },
  logoutText: { color: '#2E5496', fontWeight: '600' },

  levelCard: { backgroundColor: '#1F3864', borderRadius: 16, padding: 18, marginBottom: 14 },
  levelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  levelText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  streakChip: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  streakText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  xpTrack: { height: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 5, marginTop: 14, overflow: 'hidden' },
  xpFill: { height: 10, backgroundColor: '#5B8DEF', borderRadius: 5 },
  xpText: { color: '#C7D4EC', fontSize: 12, marginTop: 6 },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  cardLabel: { fontSize: 12, letterSpacing: 1, color: '#8A97A8', fontWeight: '700', marginBottom: 6 },
  macros: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 18 },
  macro: { flex: 1, alignItems: 'center' },
  macroDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
  macroValue: { fontSize: 15, fontWeight: '700', color: '#222' },
  macroLabel: { fontSize: 12, color: '#777', marginTop: 2, textAlign: 'center' },

  achSection: { marginTop: 4 },
  achTitle: { fontSize: 17, fontWeight: '700', color: '#1F3864', marginBottom: 10 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  badge: { width: '31%', backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center', marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  badgeLocked: { backgroundColor: '#ECEFF4' },
  badgeIcon: { fontSize: 26 },
  lockedIcon: { opacity: 0.6 },
  badgeName: { fontSize: 11, color: '#333', textAlign: 'center', marginTop: 6, fontWeight: '600' },
  lockedName: { color: '#9AA5B4', fontWeight: '400' },

  error: { color: '#B00020', fontSize: 14, marginTop: 16, textAlign: 'center' },
});
