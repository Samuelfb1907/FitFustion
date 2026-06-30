import { supabase } from './supabase';

export type ProgressionResult = {
  type: 'weight_up' | 'reps_up' | 'seeded';
  oldWeight: number | null;
  newWeight: number | null;
  oldReps: number;
  newReps: number;
};

const STEP: Record<string, number> = { barbell: 2.5, dumbbell: 1, cable: 1, machine: 2.5 };

export async function checkProgression(
  planExerciseId: string,
  equipment: string,
  sets: { reps: number | null; weight_kg: number | null }[],
  targetSets: number,
  targetReps: number,
  targetWeight: number | null,
): Promise<ProgressionResult | null> {
  if (sets.length === 0) return null;

  const validSets = sets.filter((s) => s.reps != null && s.reps > 0);
  if (validSets.length < targetSets) return null;

  const topSets = validSets.slice(0, targetSets);
  const allRepsHit = topSets.every((s) => (s.reps ?? 0) >= targetReps);
  if (!allRepsHit) return null;

  if (targetWeight == null) {
    const weights = topSets.map((s) => s.weight_kg).filter((w): w is number => w != null && w > 0);
    const seedWeight = weights.length > 0 ? Math.min(...weights) : null;
    if (seedWeight != null) {
      await supabase.from('workout_plan_exercises').update({ target_weight_kg: seedWeight }).eq('id', planExerciseId);
      return { type: 'seeded', oldWeight: null, newWeight: seedWeight, oldReps: targetReps, newReps: targetReps };
    }
    const maxReps = Math.max(...topSets.map((s) => s.reps ?? 0));
    if (maxReps > targetReps) {
      const newReps = targetReps + 1;
      await supabase.from('workout_plan_exercises').update({ target_reps: newReps }).eq('id', planExerciseId);
      return { type: 'reps_up', oldWeight: null, newWeight: null, oldReps: targetReps, newReps };
    }
    return null;
  }

  const allWeightHit = topSets.every((s) => (s.weight_kg ?? 0) >= targetWeight);
  if (!allWeightHit) return null;

  const step = STEP[equipment] ?? 1;
  const newWeight = Math.round((targetWeight + step) * 2) / 2;
  await supabase.from('workout_plan_exercises').update({ target_weight_kg: newWeight }).eq('id', planExerciseId);
  return { type: 'weight_up', oldWeight: targetWeight, newWeight, oldReps: targetReps, newReps: targetReps };
}
