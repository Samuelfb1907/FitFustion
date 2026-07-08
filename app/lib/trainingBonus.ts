// USP "Training <-> Ernaehrung": schaetzt die heute durch Training verbrannten
// Kalorien, damit das Tagesziel an Trainingstagen mitwaechst.
import { supabase } from './supabase';
import { startOfTodayISO } from './date';
import { estimateWorkoutKcal } from './nutrition';

// Basis: die heute mitgeschriebenen Saetze (set_logs). Dauer je Einheit = Zeit vom
// ersten bis zum letzten Satz -> zaehlt auch die noch LAUFENDE Einheit (nicht erst
// nach "Training beenden"). Bei einem einzelnen Satz grob ~3 Min pro Satz.
export async function todayTrainingKcal(userId: string, weightKg: number): Promise<number> {
  if (!userId || !weightKg) return 0;
  const { data } = await supabase
    .from('set_logs')
    .select('session_id, created_at')
    .eq('user_id', userId)
    .gte('created_at', startOfTodayISO());
  const bySession = new Map<string, { first: number; last: number; n: number }>();
  for (const r of (data ?? []) as any[]) {
    const ts = Date.parse(r.created_at);
    if (!isFinite(ts) || !r.session_id) continue;
    const g = bySession.get(r.session_id) ?? { first: ts, last: ts, n: 0 };
    g.first = Math.min(g.first, ts); g.last = Math.max(g.last, ts); g.n += 1;
    bySession.set(r.session_id, g);
  }
  let minutes = 0;
  for (const g of bySession.values()) {
    let m = (g.last - g.first) / 60000;
    if (m < 1) m = g.n * 3;            // sehr kurze Spanne -> grobe Annahme pro Satz
    minutes += Math.min(180, m);        // pro Einheit max 3 h
  }
  return estimateWorkoutKcal(weightKg, minutes);
}

// Heute manuell eingetragenes Cardio (Summe der bereits berechneten kcal aus
// cardio_sessions). Kommt ON TOP zum Trainings-/Schritte-Bonus, weil Cardio
// explizit vom Nutzer eingetragen wird. Fehlertolerant: liefert 0, falls die
// Tabelle (Migration 059) noch nicht eingespielt ist -> App bricht nie ab.
export async function todayCardioKcal(userId: string): Promise<number> {
  if (!userId) return 0;
  try {
    const { data, error } = await supabase
      .from('cardio_sessions')
      .select('kcal')
      .eq('user_id', userId)
      .gte('performed_at', startOfTodayISO());
    if (error) return 0;
    let sum = 0;
    for (const r of (data ?? []) as any[]) sum += Number(r.kcal) || 0;
    return sum;
  } catch {
    return 0;
  }
}
