// "Deine Karriere" (#4) + Meilensteine/Trophaeen (#6) - Lifetime-Werte aus vorhandenen Daten.
// Reine Datenschicht, keine DB-Aenderung (liest workout_sessions, set_logs, food_logs).
import { supabase } from './supabase';
import { computeLongestStreak } from './gamification';

export type Career = {
  workouts: number;     // abgeschlossene/erfasste Trainings-Sessions
  sets: number;         // mitgeschriebene Saetze
  tonnageKg: number;    // insgesamt bewegtes Gewicht (Summe weight*reps)
  foodLogs: number;     // Tracker-Eintraege
  longestStreak: number;
  activeDays: number;   // Tage mit Training ODER Tracker-Eintrag
};

export async function loadCareer(userId: string): Promise<Career> {
  const [sessRes, setRes, foodRes] = await Promise.all([
    supabase.from('workout_sessions').select('performed_at').eq('user_id', userId),
    supabase.from('set_logs').select('weight_kg, reps').eq('user_id', userId),
    supabase.from('food_logs').select('log_date').eq('user_id', userId),
  ]);
  const sessions = (sessRes.data ?? []) as any[];
  const sets = (setRes.data ?? []) as any[];
  const foods = (foodRes.data ?? []) as any[];

  const tonnageKg = sets.reduce((sum, r) => sum + (Number(r.weight_kg) || 0) * (Number(r.reps) || 0), 0);
  const days = new Set<string>();
  for (const s of sessions) if (s.performed_at) days.add(String(s.performed_at).slice(0, 10));
  for (const f of foods) if (f.log_date) days.add(String(f.log_date).slice(0, 10));

  return {
    workouts: sessions.length,
    sets: sets.length,
    tonnageKg: Math.round(tonnageKg),
    foodLogs: foods.length,
    longestStreak: computeLongestStreak([...days]),
    activeDays: days.size,
  };
}

// Meilensteine: pro Kategorie mehrere Stufen. type -> i18n-Label (career.ms.<type>, {n}).
export type Milestone = { key: string; type: string; icon: string; value: number; target: number; earned: boolean };

export function milestones(c: Career): Milestone[] {
  const defs: { type: string; icon: string; value: number; targets: number[] }[] = [
    { type: 'workouts', icon: '🏋️', value: c.workouts, targets: [1, 10, 25, 50, 100, 250] },
    { type: 'tonnage', icon: '🏗️', value: Math.floor(c.tonnageKg / 1000), targets: [10, 50, 100, 250, 500] },
    { type: 'streak', icon: '🔥', value: c.longestStreak, targets: [7, 30, 100] },
    { type: 'active', icon: '📅', value: c.activeDays, targets: [30, 100, 365] },
    { type: 'sets', icon: '🧱', value: c.sets, targets: [100, 500, 1000] },
  ];
  const out: Milestone[] = [];
  for (const d of defs) {
    for (const target of d.targets) {
      out.push({ key: `${d.type}_${target}`, type: d.type, icon: d.icon, value: d.value, target, earned: d.value >= target });
    }
  }
  // Erreichte zuerst, dann die noch offenen (jeweils naechste Stufen sichtbar).
  return out.sort((a, b) => Number(b.earned) - Number(a.earned));
}
