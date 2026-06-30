// Wochen-Bingo (#76c): 3x3-Karte mit Aufgaben, die aus der Aktivitaet DIESER Woche
// (Mo-So, lokal) berechnet werden. Eine volle Reihe/Spalte/Diagonale ODER die ganze
// Karte schenkt einen Streak-Freeze (einmal pro Woche je, via grant_freeze + user_badges
// als Anti-Doppel-Sperre, period = Montag der Woche). Rein client-berechnet wie challenges.ts.
import { supabase } from './supabase';

export type BingoMetric = 'workouts' | 'sets' | 'activeDays' | 'trackDays' | 'weightDays';
export type BingoTask = { key: string; emoji: string; metric: BingoMetric; target: number };

// 3x3 (Index 0..8). Reihenfolge = Anzeige im Raster.
export const BINGO: BingoTask[] = [
  { key: 'work1',   emoji: '🏋️', metric: 'workouts',   target: 1 },
  { key: 'sets15',  emoji: '💪', metric: 'sets',       target: 15 },
  { key: 'track1',  emoji: '🍎', metric: 'trackDays',  target: 1 },
  { key: 'active3', emoji: '🗓️', metric: 'activeDays', target: 3 },
  { key: 'work3',   emoji: '🔥', metric: 'workouts',   target: 3 },
  { key: 'sets40',  emoji: '🧱', metric: 'sets',       target: 40 },
  { key: 'weight1', emoji: '⚖️', metric: 'weightDays', target: 1 },
  { key: 'track4',  emoji: '🥗', metric: 'trackDays',  target: 4 },
  { key: 'active5', emoji: '⭐', metric: 'activeDays', target: 5 },
];

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Reihen
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Spalten
  [0, 4, 8], [2, 4, 6],            // Diagonalen
];

export type BingoCell = BingoTask & { value: number; done: boolean };
export type BingoResult = { cells: BingoCell[]; lines: number; full: boolean; newLine: boolean; newFull: boolean };

function mondayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // 0=Mo
  return d;
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function loadBingo(userId: string): Promise<BingoResult> {
  const mon = mondayLocal();
  const monIso = mon.toISOString();
  const monDate = ymd(mon);
  const period = monDate; // Montag als Wochen-Schluessel

  const [sessRes, setRes, foodRes, wRes, badgeRes] = await Promise.all([
    supabase.from('workout_sessions').select('performed_at').eq('user_id', userId).gte('performed_at', monIso),
    supabase.from('set_logs').select('id').eq('user_id', userId).gte('created_at', monIso),
    supabase.from('food_logs').select('log_date').eq('user_id', userId).gte('log_date', monDate),
    supabase.from('progress_entries').select('entry_date').eq('user_id', userId).gte('entry_date', monDate),
    supabase.from('user_badges').select('badge_key').eq('user_id', userId).eq('period', period),
  ]);

  const sessRows = (sessRes.data ?? []) as any[];
  const sessionDays = new Set(sessRows.map((r) => localDay(r.performed_at)));
  const foodDays = new Set(((foodRes.data ?? []) as any[]).map((r) => String(r.log_date).slice(0, 10)));
  const values: Record<BingoMetric, number> = {
    workouts: sessRows.length,
    sets: ((setRes.data ?? []) as any[]).length,
    trackDays: foodDays.size,
    weightDays: ((wRes.data ?? []) as any[]).length,
    activeDays: new Set<string>([...sessionDays, ...foodDays]).size,
  };

  const cells: BingoCell[] = BINGO.map((t) => {
    const value = values[t.metric];
    return { ...t, value, done: value >= t.target };
  });

  const lines = LINES.filter((ln) => ln.every((i) => cells[i].done)).length;
  const full = cells.every((c) => c.done);

  // Belohnungen: erste Reihe + volle Karte je einmal pro Woche -> Freeze geschenkt.
  const have = new Set(((badgeRes.data ?? []) as any[]).map((b) => b.badge_key));
  let newLine = false, newFull = false, gifts = 0;
  if (lines >= 1 && !have.has('bingo_line')) {
    const { error } = await supabase.from('user_badges').insert({ user_id: userId, badge_key: 'bingo_line', period });
    if (!error) { newLine = true; gifts++; }
  }
  if (full && !have.has('bingo_full')) {
    const { error } = await supabase.from('user_badges').insert({ user_id: userId, badge_key: 'bingo_full', period });
    if (!error) { newFull = true; gifts++; }
  }
  if (gifts > 0) await supabase.rpc('grant_freeze', { p_n: gifts });

  return { cells, lines, full, newLine, newFull };
}
