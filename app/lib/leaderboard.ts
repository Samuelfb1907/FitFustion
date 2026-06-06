// Bestenliste-Logik: aktive Ziel-Tage (getrackt ODER trainiert) pro Woche/Monat.
// Datenschutz: Teilnahme ist opt-in (eigene Zeile in leaderboard_entries). Kein Eintrag = privat.
import { supabase } from './supabase';
import { localDateStr, daysAgoStr, daysAgoISO, mondayStr } from './date';
import { computeStreak } from './gamification';

export type LeaderRow = {
  user_id: string;
  display_name: string;
  weekly_days: number;
  monthly_days: number;
  streak: number;
  week_key: string | null;
  month_key: string | null;
};

// Montag-Datum der aktuellen Woche als Schluessel/Grenze ("YYYY-MM-DD").
export function weekKey(d: Date = new Date()): string {
  return mondayStr(d); // Montag der Woche -> Wochen-Schluessel
}
// Aktueller Monat als Schluessel ("YYYY-MM").
export function monthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

type Scores = { weekly: number; monthly: number; streak: number; week_key: string; month_key: string };

// Zaehlt aktive Ziel-Tage (Tage mit Essens-Eintrag ODER Training) diese Woche/diesen Monat.
export async function computeMyScores(userId: string): Promise<Scores> {
  // Auf ~13 Monate begrenzen: Wochen-/Monatswertung & Streak bleiben korrekt, Query bleibt klein.
  const sinceDate = daysAgoStr(400);
  const sinceIso = daysAgoISO(400);
  const [fd, sd] = await Promise.all([
    supabase.from('food_logs').select('log_date').eq('user_id', userId).gte('log_date', sinceDate),
    supabase.from('workout_sessions').select('performed_at').eq('user_id', userId).gte('performed_at', sinceIso),
  ]);
  const dates = new Set<string>();
  ((fd.data ?? []) as any[]).forEach((r) => dates.add(String(r.log_date).slice(0, 10)));
  ((sd.data ?? []) as any[]).forEach((r) => { const d = localDateStr(r.performed_at); if (d) dates.add(d); });

  const mon = weekKey();
  const mk = monthKey();
  let weekly = 0, monthly = 0;
  for (const d of dates) {
    if (d >= mon) weekly++;
    if (d.slice(0, 7) === mk) monthly++;
  }
  return { weekly, monthly, streak: computeStreak([...dates]), week_key: mon, month_key: mk };
}

// Meinen Eintrag holen (null = nehme nicht teil / privat).
export async function getMyEntry(userId: string): Promise<LeaderRow | null> {
  const { data, error } = await supabase.from('leaderboard_entries').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return (data as LeaderRow) ?? null;
}

// Teilnehmen / Anzeigename setzen + aktuelle Werte schreiben.
export async function joinLeaderboard(userId: string, displayName: string): Promise<string | null> {
  try {
    const s = await computeMyScores(userId);
    const { error } = await supabase.from('leaderboard_entries').upsert({
      user_id: userId, display_name: displayName,
      weekly_days: s.weekly, monthly_days: s.monthly, streak: s.streak,
      week_key: s.week_key, month_key: s.month_key, updated_at: new Date().toISOString(),
    });
    return error ? error.message : null;
  } catch (e: any) {
    return e?.message ?? 'Fehler';
  }
}

// Nur die Werte aktualisieren (Name bleibt). No-op, wenn keine Zeile existiert.
export async function refreshMyScores(userId: string): Promise<void> {
  const s = await computeMyScores(userId);
  await supabase.from('leaderboard_entries').update({
    weekly_days: s.weekly, monthly_days: s.monthly, streak: s.streak,
    week_key: s.week_key, month_key: s.month_key, updated_at: new Date().toISOString(),
  }).eq('user_id', userId);
}

export async function updateName(userId: string, displayName: string): Promise<string | null> {
  const { error } = await supabase.from('leaderboard_entries').update({ display_name: displayName }).eq('user_id', userId);
  return error ? error.message : null;
}

// Teilnahme beenden -> Zeile loeschen -> wieder privat.
export async function leaveLeaderboard(userId: string): Promise<string | null> {
  const { error } = await supabase.from('leaderboard_entries').delete().eq('user_id', userId);
  return error ? error.message : null;
}

// Ganze Liste laden (clientseitig nach effektiver Punktzahl sortiert).
export async function fetchBoard(): Promise<LeaderRow[]> {
  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select('user_id, display_name, weekly_days, monthly_days, streak, week_key, month_key')
    .limit(200);
  if (error) throw error;
  return (data ?? []) as LeaderRow[];
}

// Effektive Punktzahl: veraltete Wochen/Monate zaehlen als 0 (fair fuer "diese Woche/diesen Monat").
export function effectiveScore(row: LeaderRow, period: 'week' | 'month'): number {
  if (period === 'week') return row.week_key === weekKey() ? row.weekly_days : 0;
  return row.month_key === monthKey() ? row.monthly_days : 0;
}
