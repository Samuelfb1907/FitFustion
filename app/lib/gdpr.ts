// DSGVO-Funktionen: Datenexport (Art. 15/20) und Loeschung aller Nutzerdaten (Art. 17).
import { supabase } from './supabase';

// Reihenfolge: Kinder vor Eltern (FK-sicher); foods erst NACH food_logs/recipe_items; profiles zuletzt.
const USER_TABLES = [
  'set_logs', 'workout_sessions', 'plan_schedule', 'workout_plan_exercises', 'workout_plan_days', 'workout_plans',
  'meals', 'nutrition_plans', 'recipe_items', 'recipes', 'food_logs', 'water_logs', 'progress_entries', 'goals', 'user_achievements',
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
  return out;
}

// Loescht alle Datenzeilen des Nutzers (das Auth-Konto selbst braucht die Edge Function unten).
export async function deleteAllUserData(userId: string): Promise<void> {
  for (const t of USER_TABLES) {
    await supabase.from(t).delete().eq('user_id', userId);
  }
  await supabase.from('foods').delete().eq('user_id', userId);
  await supabase.from('profiles').delete().eq('id', userId);
}

// Versucht serverseitige Konto-Loeschung (Edge Function "delete-account").
// Faellt immer auf die client-seitige Daten-Loeschung zurueck. serverDeleted=true => Auth-Konto entfernt.
export async function deleteAccount(userId: string): Promise<{ serverDeleted: boolean }> {
  let serverDeleted = false;
  try {
    const { error } = await supabase.functions.invoke('delete-account');
    if (!error) serverDeleted = true;
  } catch {
    serverDeleted = false;
  }
  try { await deleteAllUserData(userId); } catch {}
  return { serverDeleted };
}
