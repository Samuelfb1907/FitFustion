// Intervallfasten (#2) - Datenschicht. Ein offenes Fenster (ended_at null) = laeuft gerade.
// Streak = aufeinanderfolgende Tage mit einem GESCHAFFTEN Fasten (Dauer >= Ziel). Migration 049.
import { supabase } from './supabase';
import { computeStreak } from './gamification';

export type Fast = { id: string; started_at: string; target_hours: number; ended_at: string | null };

export async function loadFasting(userId: string): Promise<{ active: Fast | null; streak: number; recent: Fast[] }> {
  const { data } = await supabase
    .from('fasting_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(60);
  const rows = (data ?? []) as Fast[];
  const active = rows.find((r) => !r.ended_at) ?? null;
  const days = new Set<string>();
  for (const r of rows) {
    if (!r.ended_at) continue;
    const dur = (new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 3600000;
    if (dur >= r.target_hours) days.add(String(r.ended_at).slice(0, 10));
  }
  const recent = rows.filter((r) => r.ended_at).slice(0, 5);
  return { active, streak: computeStreak([...days]), recent };
}

export async function startFast(userId: string, targetHours: number): Promise<Fast | null> {
  const { data, error } = await supabase
    .from('fasting_sessions')
    .insert({ user_id: userId, target_hours: targetHours })
    .select()
    .single();
  if (error) return null;
  return data as Fast;
}

export async function endFast(id: string): Promise<void> {
  await supabase.from('fasting_sessions').update({ ended_at: new Date().toISOString() }).eq('id', id);
}
