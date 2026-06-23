// Streak-System (#2/#46) - Datenschicht. Server-seitiger, persistenter Streak (Migration 051).
// touchStreak() zaehlt den heutigen aktiven Tag (nur aufrufen, wenn heute Aktivitaet vorliegt).
import { supabase } from './supabase';

export type StreakState = {
  streak: number;       // aktuelle Tage in Folge
  best: number;         // laengste je erreichte Serie
  freezeTokens: number; // verbleibende Freezes diese Woche
  milestone: number;    // neu erreichter Meilenstein (3/7/30/100) oder 0
  freezeUsed: boolean;  // ob heute/zuletzt ein Freeze einen Fehltag ueberbrueckt hat
};

export async function touchStreak(today: string, seed = 0): Promise<StreakState | null> {
  const { data, error } = await supabase.rpc('touch_streak', { p_today: today, p_seed: seed });
  if (error) return null;
  const row: any = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    streak: row.streak ?? 0,
    best: row.best ?? 0,
    freezeTokens: row.freeze_tokens ?? 0,
    milestone: row.milestone ?? 0,
    freezeUsed: !!row.freeze_used,
  };
}
