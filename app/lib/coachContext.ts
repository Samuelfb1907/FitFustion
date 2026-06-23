// Kompakter, DSGVO-schonender Trainings-Kontext fuer den KI-Coach.
// BEWUSST KEINE Koerper-/Gewichts-/Zieldaten (Art. 9) - nur Trainings-Aktivitaet.
import { supabase } from './supabase';

export async function workoutsLast7Days(userId: string): Promise<number> {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const { count, error } = await supabase
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('performed_at', since);
  if (error) return 0;
  return count ?? 0;
}
