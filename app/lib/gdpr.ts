// DSGVO-Funktionen: Datenexport (Art. 15/20) und Loeschung aller Nutzerdaten (Art. 17).
import { supabase } from './supabase';

// Reihenfolge: Kinder vor Eltern (FK-sicher); foods erst NACH food_logs; profiles zuletzt.
const USER_TABLES = [
  'set_logs', 'workout_sessions', 'plan_schedule', 'workout_plan_exercises', 'workout_plan_days', 'workout_plans',
  'food_logs', 'water_logs', 'progress_entries', 'goals', 'user_achievements',
];

// Sammelt alle personenbezogenen Daten des Nutzers als JSON-Objekt.
export async function exportUserData(userId: string): Promise<Record<string, any>> {
  const out: Record<string, any> = { app: 'FitAvo', user_id: userId };
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  out.profile = profile ?? null;
  for (const t of USER_TABLES) {
    const { data } = await supabase.from(t).select('*').eq('user_id', userId);
    out[t] = data ?? [];
  }
  const { data: ownFoods } = await supabase.from('foods').select('*').eq('user_id', userId);
  out.foods_eigene = ownFoods ?? [];
  const { data: lb } = await supabase.from('leaderboard_entries').select('*').eq('user_id', userId);
  out.leaderboard_entries = lb ?? [];
  return out;
}

// Loescht alle Datenzeilen des Nutzers (das Auth-Konto selbst braucht die Edge Function unten).
// Loescht alle Datenzeilen des Nutzers und meldet, welche Tabellen (falls ueberhaupt)
// fehlschlugen - kein stilles Verschlucken mehr.
export async function deleteAllUserData(userId: string): Promise<{ ok: boolean; failed: string[] }> {
  const failed: string[] = [];
  for (const t of USER_TABLES) {
    const { error } = await supabase.from(t).delete().eq('user_id', userId);
    if (error) failed.push(t);
  }
  // Bestenlisten-Eintrag (opt-in) VOR profiles entfernen
  const lb = await supabase.from('leaderboard_entries').delete().eq('user_id', userId);
  if (lb.error) failed.push('leaderboard_entries');
  const fo = await supabase.from('foods').delete().eq('user_id', userId);
  if (fo.error) failed.push('foods');
  const pr = await supabase.from('profiles').delete().eq('id', userId);
  if (pr.error) failed.push('profiles');
  return { ok: failed.length === 0, failed };
}

// Versucht serverseitige Konto-Loeschung (Edge Function "delete-account"): entfernt das
// Auth-Konto + alle Daten per Cascade. Ist sie nicht verfuegbar, wird client-seitig geloescht.
// Gibt ehrlich zurueck, was passiert ist (kein Falsch-Erfolg).
export async function deleteAccount(userId: string): Promise<{ serverDeleted: boolean; dataDeleted: boolean; failed: string[] }> {
  let serverDeleted = false;
  try {
    const { error } = await supabase.functions.invoke('delete-account');
    if (!error) serverDeleted = true;
  } catch {
    serverDeleted = false;
  }
  if (serverDeleted) return { serverDeleted: true, dataDeleted: true, failed: [] };
  const r = await deleteAllUserData(userId);
  return { serverDeleted: false, dataDeleted: r.ok, failed: r.failed };
}
