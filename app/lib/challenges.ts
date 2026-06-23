// Monats-Challenges + Abzeichen (#3/#68). Feste Monatsziele (jeden Monat gleich); der
// Fortschritt wird aus der Aktivitaet des laufenden Monats berechnet. Verdiente Abzeichen
// landen in user_badges (Migration 052). Alles in Expo Go lauffaehig (keine Schritte/Push).
import { supabase } from './supabase';

export type Metric = 'workouts' | 'trackDays' | 'activeDays';
export type Challenge = { key: string; icon: string; metric: Metric; target: number };

export const CHALLENGES: Challenge[] = [
  { key: 'workouts12', icon: '🏋️', metric: 'workouts', target: 12 },
  { key: 'track20', icon: '📒', metric: 'trackDays', target: 20 },
  { key: 'active24', icon: '🔥', metric: 'activeDays', target: 24 },
];

export type ChallengeProgress = Challenge & { value: number; done: boolean; earned: boolean };
export type ChallengesResult = { items: ChallengeProgress[]; newlyEarned: ChallengeProgress[] };

export function monthKeyOf(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function loadChallenges(userId: string): Promise<ChallengesResult> {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const startIso = new Date(y, m, 1).toISOString();
  const startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const period = monthKeyOf(now);

  const [sessRes, fdRes, badgeRes] = await Promise.all([
    supabase.from('workout_sessions').select('performed_at').eq('user_id', userId).gte('performed_at', startIso),
    supabase.from('food_logs').select('log_date').eq('user_id', userId).gte('log_date', startDate),
    supabase.from('user_badges').select('badge_key').eq('user_id', userId).eq('period', period),
  ]);

  const sessRows = (sessRes.data ?? []) as any[];
  const fdRows = (fdRes.data ?? []) as any[];
  const earnedSet = new Set(((badgeRes.data ?? []) as any[]).map((b) => b.badge_key));

  const localDay = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const sessionDays = new Set(sessRows.map((r) => localDay(r.performed_at)));
  const trackDays = new Set(fdRows.map((r) => String(r.log_date).slice(0, 10)));
  const activeDays = new Set<string>([...sessionDays, ...trackDays]);

  const valueOf = (metric: Metric): number =>
    metric === 'workouts' ? sessRows.length : metric === 'trackDays' ? trackDays.size : activeDays.size;

  const items: ChallengeProgress[] = CHALLENGES.map((ch) => {
    const value = valueOf(ch.metric);
    return { ...ch, value, done: value >= ch.target, earned: earnedSet.has(ch.key) };
  });

  // Neu abgeschlossene Challenges -> Abzeichen vergeben (idempotent dank Unique-Constraint).
  const newlyEarned: ChallengeProgress[] = [];
  for (const it of items) {
    if (it.done && !it.earned) {
      const { error } = await supabase.from('user_badges').insert({ user_id: userId, badge_key: it.key, period });
      if (!error) { it.earned = true; newlyEarned.push(it); }
    }
  }
  return { items, newlyEarned };
}
