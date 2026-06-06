// USP "Training <-> Ernaehrung": schaetzt die heute durch Training verbrannten
// Kalorien, damit das Tagesziel an Trainingstagen mitwaechst. Nur ABGESCHLOSSENE
// Einheiten zaehlen (ended_at gesetzt) - die laufende Einheit erst nach "Beenden".
import { supabase } from './supabase';
import { startOfTodayISO } from './date';
import { estimateWorkoutKcal } from './nutrition';

export async function todayTrainingKcal(userId: string, weightKg: number): Promise<number> {
  if (!userId || !weightKg) return 0;
  const { data } = await supabase
    .from('workout_sessions')
    .select('performed_at, ended_at')
    .eq('user_id', userId)
    .gte('performed_at', startOfTodayISO());
  let minutes = 0;
  for (const s of (data ?? []) as any[]) {
    if (!s.ended_at) continue; // nur abgeschlossene Einheiten
    const start = new Date(s.performed_at).getTime();
    const end = new Date(s.ended_at).getTime();
    if (isFinite(start) && isFinite(end) && end > start) {
      minutes += Math.min(180, (end - start) / 60000); // pro Einheit max 3 h
    }
  }
  return estimateWorkoutKcal(weightKg, minutes);
}
