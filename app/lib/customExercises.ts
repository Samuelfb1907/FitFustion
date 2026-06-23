// Eigene Uebungen (#7) - Datenschicht. Legt echte exercises-Zeilen mit created_by an
// (Migration 050), damit Saetze (set_logs FK) ganz normal geloggt werden koennen.
import { supabase } from './supabase';

export async function createCustomExercise(
  userId: string,
  name: string,
  muscleId: string,
  equipment: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('exercises')
    .insert({
      name: name.trim().slice(0, 60),
      difficulty: 'intermediate',
      equipment,
      primary_muscle_id: muscleId,
      description: '',
      instructions: '',
      created_by: userId,
    })
    .select('id')
    .single();
  if (error) return null;
  return (data as any)?.id ?? null;
}

// Loescht eine eigene Uebung. false, wenn nicht moeglich (z. B. bereits Saetze geloggt -> FK).
export async function deleteCustomExercise(id: string): Promise<boolean> {
  const { error } = await supabase.from('exercises').delete().eq('id', id);
  return !error;
}
