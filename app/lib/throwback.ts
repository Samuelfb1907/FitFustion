// Rueckblick "Vor X Monaten" (#76d): vergleicht einen frueheren Datenpunkt mit heute,
// damit der Nutzer seinen Fortschritt schwarz auf weiss sieht. Zwei moegliche Karten:
// (1) Koerpergewicht (aeltester Eintrag -> aktuell), (2) staerkste Steigerung bei einer
// Uebung (fruehestes Gewicht -> persoenliche Bestleistung). Rein client-berechnet.
import { supabase } from './supabase';

export type ThrowbackItem =
  | { type: 'weight'; days: number; then: number; now: number }
  | { type: 'lift'; days: number; then: number; now: number; name: string };

const MIN_AGE_DAYS = 45; // "frueher" muss mind. so alt sein, damit der Rueckblick sinnvoll ist

function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export async function loadThrowback(userId: string): Promise<ThrowbackItem[]> {
  const [wRes, sRes] = await Promise.all([
    supabase.from('progress_entries').select('entry_date, weight_kg').eq('user_id', userId).order('entry_date', { ascending: true }),
    supabase.from('set_logs').select('weight_kg, created_at, exercises(name)').eq('user_id', userId).not('weight_kg', 'is', null).order('created_at', { ascending: true }),
  ]);

  const items: ThrowbackItem[] = [];

  // 1) Gewicht: aeltester Eintrag (>= MIN_AGE_DAYS) vs. neuester.
  const wRows = ((wRes.data ?? []) as any[]).filter((r) => r.weight_kg != null);
  if (wRows.length >= 2) {
    const oldest = wRows[0];
    const newest = wRows[wRows.length - 1];
    const days = ageDays(oldest.entry_date + 'T00:00:00');
    const then = Number(oldest.weight_kg), now = Number(newest.weight_kg);
    if (days >= MIN_AGE_DAYS && Math.abs(now - then) >= 0.5) {
      items.push({ type: 'weight', days, then: Math.round(then * 10) / 10, now: Math.round(now * 10) / 10 });
    }
  }

  // 2) Lift: je Uebung fruehestes Gewicht (>= MIN_AGE_DAYS alt) vs. persoenliche Bestleistung.
  const sRows = (sRes.data ?? []) as any[];
  const first: Record<string, { w: number; iso: string }> = {};
  const best: Record<string, number> = {};
  for (const r of sRows) {
    const name = Array.isArray(r.exercises) ? r.exercises[0]?.name : r.exercises?.name;
    const w = Number(r.weight_kg) || 0;
    if (!name || w <= 0) continue;
    if (!first[name]) first[name] = { w, iso: r.created_at };
    best[name] = Math.max(best[name] ?? 0, w);
  }
  let pick: ThrowbackItem | null = null;
  let bestGain = 0;
  for (const name of Object.keys(first)) {
    const f = first[name];
    const days = ageDays(f.iso);
    const gain = (best[name] ?? 0) - f.w;
    if (days >= MIN_AGE_DAYS && gain > bestGain) {
      bestGain = gain;
      pick = { type: 'lift', days, then: f.w, now: best[name], name };
    }
  }
  if (pick) items.push(pick);

  return items;
}
