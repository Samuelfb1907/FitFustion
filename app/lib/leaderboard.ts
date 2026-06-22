// Bestenliste-Logik: aktive Ziel-Tage (getrackt ODER trainiert) pro Woche/Monat.
// Datenschutz: Teilnahme ist opt-in (eigene Zeile in leaderboard_entries). Kein Eintrag = privat.
import { supabase } from './supabase';
import { mondayStr } from './date';

export type LeaderRow = {
  is_me: boolean;
  display_name: string;
  weekly_days: number;
  monthly_days: number;
  streak: number;
  week_key: string | null;
  month_key: string | null;
};

// HINWEIS Zeitzone: weekKey()/monthKey()/effectiveScore() rechnen in Geraetezeit,
// der Server-Trigger (Migration 024) setzt week_key/month_key in Europe/Berlin.
// Fuer die DE-Zielgruppe (Europe/Berlin) deckungsgleich. Bei abweichender Geraete-TZ
// koennen die Schluessel am Wochen-/Monatswechsel kurzzeitig divergieren; effectiveScore()
// wertet die Zeile dann als veraltet (0), bis refreshMyScores() den Server-Recompute ausloest.
// Montag-Datum der aktuellen Woche als Schluessel/Grenze ("YYYY-MM-DD").
export function weekKey(d: Date = new Date()): string {
  return mondayStr(d); // Montag der Woche -> Wochen-Schluessel
}
// Aktueller Monat als Schluessel ("YYYY-MM").
export function monthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Meinen Eintrag holen (null = nehme nicht teil / privat).
export async function getMyEntry(userId: string): Promise<LeaderRow | null> {
  const { data, error } = await supabase.from('leaderboard_entries')
    .select('display_name, weekly_days, monthly_days, streak, week_key, month_key')
    .eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? ({ ...(data as any), is_me: true } as LeaderRow) : null;
}

// Teilnehmen / Anzeigename setzen. Punkte (weekly/monthly/streak, week_key/month_key)
// berechnet der Server-Trigger (Migration 024) aus den eigenen Logs des Nutzers.
export async function joinLeaderboard(userId: string, displayName: string): Promise<string | null> {
  const { error } = await supabase.from('leaderboard_entries').upsert({
    user_id: userId, display_name: displayName,
  });
  return error ? error.message : null;
}

// Server-Recompute ausloesen: leeres Touch genuegt, der BEFORE-UPDATE-Trigger
// (Migration 024) berechnet alle Punkte serverseitig neu. No-op ohne Zeile.
export async function refreshMyScores(userId: string): Promise<void> {
  await supabase.from('leaderboard_entries')
    .update({ updated_at: new Date().toISOString() })
    .eq('user_id', userId);
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
    .from('leaderboard_public')
    .select('display_name, weekly_days, monthly_days, streak, week_key, month_key, is_me')
    .limit(200);
  if (error) throw error;
  return (data ?? []) as LeaderRow[];
}

// Effektive Punktzahl: veraltete Wochen/Monate zaehlen als 0 (fair fuer "diese Woche/diesen Monat").
export function effectiveScore(row: LeaderRow, period: 'week' | 'month'): number {
  if (period === 'week') return row.week_key === weekKey() ? row.weekly_days : 0;
  return row.month_key === monthKey() ? row.monthly_days : 0;
}
