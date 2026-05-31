// Gemeinsame Logik fuer das Gewichts-Tracking (genutzt von Start- und Fortschritt-Screen).
// Schreibt in progress_entries (ein Eintrag pro Tag) und haelt profiles.weight_kg aktuell,
// damit das Kalorienziel mitwandert.
import { supabase } from './supabase';

export const WEIGHT_MIN = 30;
export const WEIGHT_MAX = 300;

export type WeightPoint = { id: string; date: string; kg: number };

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgoStr(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Parst eine Eingabe ("82,5" -> 82.5) und prueft die Grenzen. null = ungueltig.
export function parseWeight(input: string): number | null {
  const w = Number(String(input).replace(',', '.'));
  if (!w || w < WEIGHT_MIN || w > WEIGHT_MAX) return null;
  return Math.round(w * 10) / 10;
}

// Speichert das heutige Gewicht (legt an oder aktualisiert) + Profil. Gibt Fehlertext oder null zurueck.
export async function saveTodayWeight(userId: string, kg: number): Promise<string | null> {
  const today = todayStr();
  const { data: ex } = await supabase
    .from('progress_entries').select('id').eq('user_id', userId).eq('entry_date', today).maybeSingle();
  const res = ex?.id
    ? await supabase.from('progress_entries').update({ weight_kg: kg }).eq('id', ex.id)
    : await supabase.from('progress_entries').insert({ user_id: userId, entry_date: today, weight_kg: kg });
  await supabase.from('profiles').update({ weight_kg: kg }).eq('id', userId);
  return res.error ? res.error.message : null;
}

// Laedt alle Gewichtseintraege (aufsteigend nach Datum).
export async function loadWeights(userId: string): Promise<WeightPoint[]> {
  const { data } = await supabase
    .from('progress_entries').select('id, entry_date, weight_kg')
    .eq('user_id', userId).order('entry_date', { ascending: true });
  return ((data ?? []) as any[])
    .filter((r) => r.weight_kg != null)
    .map((r) => ({ id: String(r.id), date: String(r.entry_date), kg: Number(r.weight_kg) }));
}

export async function deleteWeight(id: string): Promise<void> {
  await supabase.from('progress_entries').delete().eq('id', id);
}

// Veraenderung ueber die letzten `days` Tage: aktuelles Gewicht minus naechstgelegener
// Eintrag am/vor dem Stichtag (oder erster Eintrag, falls alle juenger sind). null = zu wenig Daten.
export function deltaOver(weights: WeightPoint[], days: number): number | null {
  if (weights.length < 2) return null;
  const cutoff = daysAgoStr(days);
  let base: WeightPoint | null = null;
  for (const w of weights) if (w.date <= cutoff) base = w;
  if (!base) base = weights[0];
  const cur = weights[weights.length - 1].kg;
  if (base === weights[weights.length - 1]) return null;
  return Math.round((cur - base.kg) * 10) / 10;
}
