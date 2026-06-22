// Koerpermasse (Umfaenge in cm) - Datenschicht. Tabelle body_measurements (Migration 039),
// per RLS auf den eigenen Nutzer beschraenkt. Reine Datenzugriffe; die UI nutzt diese
// Funktionen (Fortschritt-Tab). Faellt ohne eingespielte Migration mit Fehler zurueck,
// den die UI abfangen kann (kein Crash).
import { supabase } from './supabase';

export type Measurement = {
  id: string;
  measured_on: string; // YYYY-MM-DD
  waist_cm: number | null;
  chest_cm: number | null;
  hips_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
};

export type MeasurementInput = {
  waist_cm?: number | null;
  chest_cm?: number | null;
  hips_cm?: number | null;
  arm_cm?: number | null;
  thigh_cm?: number | null;
};

export const MEASUREMENT_FIELDS = ['waist_cm', 'chest_cm', 'hips_cm', 'arm_cm', 'thigh_cm'] as const;

// Neueste Messungen (Standard 60), absteigend nach Datum.
export async function loadMeasurements(userId: string, limit = 60): Promise<Measurement[]> {
  const { data, error } = await supabase
    .from('body_measurements')
    .select('id, measured_on, waist_cm, chest_cm, hips_cm, arm_cm, thigh_cm')
    .eq('user_id', userId)
    .order('measured_on', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Measurement[];
}

// Eine Messung speichern (nur gesetzte Felder). Gibt null bei Erfolg, sonst die Fehlermeldung.
export async function addMeasurement(userId: string, m: MeasurementInput): Promise<string | null> {
  const row: Record<string, unknown> = { user_id: userId };
  for (const k of MEASUREMENT_FIELDS) {
    const v = m[k];
    if (v != null && isFinite(v)) row[k] = v;
  }
  if (Object.keys(row).length <= 1) return 'Bitte mindestens einen Wert eingeben.';
  const { error } = await supabase.from('body_measurements').insert(row);
  return error ? error.message : null;
}

export async function deleteMeasurement(id: string): Promise<void> {
  await supabase.from('body_measurements').delete().eq('id', id);
}
