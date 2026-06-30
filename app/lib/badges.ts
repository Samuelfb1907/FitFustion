// Abzeichen-Sammlung (Belohnung). Einmalige Achievements aus Solo-Statistiken:
// Trainings-Anzahl, beste Streak, protokollierte Saetze. Verdiente Abzeichen landen in
// user_badges mit period = '-' (zur Abgrenzung von den Monats-Abzeichen). Pro NEU
// verdientem Abzeichen wird ein Streak-Freeze geschenkt (grant_freeze, Migration 055).
import { supabase } from './supabase';

export type BadgeKind = 'workouts' | 'streak' | 'sets';
export type Badge = { key: string; emoji: string; kind: BadgeKind; threshold: number };

// Reihenfolge = Anzeige im Trophaeen-Raum. Schwellen aufsteigend je Kategorie.
export const ACHIEVEMENTS: Badge[] = [
  { key: 'work_1',     emoji: '🏋️', kind: 'workouts', threshold: 1 },
  { key: 'streak_3',   emoji: '✨',  kind: 'streak',   threshold: 3 },
  { key: 'work_10',    emoji: '💪',  kind: 'workouts', threshold: 10 },
  { key: 'streak_7',   emoji: '📅',  kind: 'streak',   threshold: 7 },
  { key: 'sets_50',    emoji: '📈',  kind: 'sets',     threshold: 50 },
  { key: 'work_25',    emoji: '🔥',  kind: 'workouts', threshold: 25 },
  { key: 'streak_14',  emoji: '⚡',  kind: 'streak',   threshold: 14 },
  { key: 'sets_250',   emoji: '🧱',  kind: 'sets',     threshold: 250 },
  { key: 'work_50',    emoji: '⭐',  kind: 'workouts', threshold: 50 },
  { key: 'streak_30',  emoji: '🌟',  kind: 'streak',   threshold: 30 },
  { key: 'sets_500',   emoji: '🗿',  kind: 'sets',     threshold: 500 },
  { key: 'work_100',   emoji: '🏆',  kind: 'workouts', threshold: 100 },
  { key: 'streak_100', emoji: '👑',  kind: 'streak',   threshold: 100 },
  { key: 'sets_1000',  emoji: '💎',  kind: 'sets',     threshold: 1000 },
];

export const ACHV_PERIOD = '-'; // period-Wert fuer einmalige Abzeichen

export type BadgeView = Badge & { earned: boolean; value: number };
export type TrophyResult = { items: BadgeView[]; earnedCount: number; newlyEarned: BadgeView[] };

async function countRows(table: string, userId: string): Promise<number> {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId);
  return count ?? 0;
}

export async function loadTrophy(userId: string): Promise<TrophyResult> {
  const [workouts, sets, profRes, badgeRes] = await Promise.all([
    countRows('workout_sessions', userId),
    countRows('set_logs', userId),
    supabase.from('profiles').select('streak_best').eq('id', userId).maybeSingle(),
    supabase.from('user_badges').select('badge_key').eq('user_id', userId).eq('period', ACHV_PERIOD),
  ]);
  const streakBest = (profRes.data as any)?.streak_best ?? 0;
  const already = new Set(((badgeRes.data ?? []) as any[]).map((b) => b.badge_key));
  const statOf = (kind: BadgeKind) => (kind === 'workouts' ? workouts : kind === 'sets' ? sets : streakBest);

  const items: BadgeView[] = ACHIEVEMENTS.map((b) => {
    const value = statOf(b.kind);
    return { ...b, value, earned: already.has(b.key) || value >= b.threshold };
  });

  // Neu verdiente Abzeichen schreiben (idempotent dank Unique-Constraint) + Freeze schenken.
  const newlyEarned: BadgeView[] = [];
  for (const it of items) {
    if (it.value >= it.threshold && !already.has(it.key)) {
      const { error } = await supabase.from('user_badges').insert({ user_id: userId, badge_key: it.key, period: ACHV_PERIOD });
      if (!error) newlyEarned.push(it);
    }
  }
  if (newlyEarned.length > 0) {
    await supabase.rpc('grant_freeze', { p_n: newlyEarned.length });
  }

  const earnedCount = items.filter((b) => b.earned).length;
  return { items, earnedCount, newlyEarned };
}

// Nur die Anzahl verdienter Abzeichen (fuer das Freischalten der Akzentfarben).
export async function earnedBadgeCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('user_badges').select('*', { count: 'exact', head: true })
    .eq('user_id', userId).eq('period', ACHV_PERIOD);
  return count ?? 0;
}
