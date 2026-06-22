// Muskel-Erholung (#67): pro Muskel(-Key) "vor wie vielen Tagen zuletzt trainiert".
// Quelle: set_logs (hat user_id + created_at) -> exercise -> primary_muscle -> muscles.key.
// Fenster: letzte 10 Tage; aeltere/nie trainierte Muskeln tauchen nicht auf (gelten als frisch).
import { supabase } from './supabase';

export async function loadMuscleRecovery(userId: string): Promise<Record<string, number>> {
  const since = new Date();
  since.setDate(since.getDate() - 10);
  since.setHours(0, 0, 0, 0);

  const { data: logs, error } = await supabase
    .from('set_logs')
    .select('exercise_id, created_at')
    .eq('user_id', userId)
    .gte('created_at', since.toISOString());
  if (error || !logs?.length) return {};

  const exIds = [...new Set((logs as any[]).map((l) => l.exercise_id).filter(Boolean))];
  if (!exIds.length) return {};
  const { data: exs } = await supabase.from('exercises').select('id, primary_muscle_id').in('id', exIds);
  const muscleIds = [...new Set((exs ?? []).map((e: any) => e.primary_muscle_id).filter(Boolean))];
  if (!muscleIds.length) return {};
  const { data: muscles } = await supabase.from('muscles').select('id, key').in('id', muscleIds);

  const idToKey: Record<string, string> = {};
  for (const m of (muscles ?? []) as any[]) idToKey[m.id] = m.key;
  const exToKey: Record<string, string> = {};
  for (const e of (exs ?? []) as any[]) { const k = idToKey[e.primary_muscle_id]; if (k) exToKey[e.id] = k; }

  const now = Date.now();
  const recent: Record<string, number> = {};
  for (const l of logs as any[]) {
    const key = exToKey[l.exercise_id];
    if (!key) continue;
    const days = Math.floor((now - new Date(l.created_at).getTime()) / 86400000);
    if (recent[key] == null || days < recent[key]) recent[key] = days;
  }
  return recent;
}
