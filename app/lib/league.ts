// Trainings-Liga (#76b) - Datenschicht. Wochen-Liga mit Auf-/Abstieg (Migration 054).
// Punkte werden serverseitig aus den Trainings-Logs berechnet; Bots fuellen die Liga auf.
import { supabase } from './supabase';

export type LeagueRow = {
  displayName: string;
  points: number;
  tier: number;       // 1=Bronze ... 5=Diamant
  isMe: boolean;
  isBot: boolean;
};

// Anzahl Stufen + feste Zonengroesse (muss zur Settlement-Logik in 054 passen: 25%).
export const LEAGUE_TIERS = 5;
export function zoneSize(n: number): number {
  return Math.max(1, Math.floor(n * 0.25));
}

// Rangliste der eigenen Liga-Instanz dieser Woche. [] = noch nicht beigetreten,
// null = Fehler.
export async function leagueBoard(): Promise<LeagueRow[] | null> {
  const { data, error } = await supabase.rpc('league_board');
  if (error) return null;
  return ((data ?? []) as any[]).map((r) => ({
    displayName: r.display_name,
    points: r.points ?? 0,
    tier: r.tier ?? 1,
    isMe: !!r.is_me,
    isBot: !!r.is_bot,
  }));
}

// Der Liga beitreten (oder Anzeigenamen aktualisieren). Gibt die Stufe (1-5) zurueck, null bei Fehler.
export async function leagueJoin(displayName: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('league_join', { p_display_name: displayName });
  if (error) return null;
  return typeof data === 'number' ? data : null;
}
