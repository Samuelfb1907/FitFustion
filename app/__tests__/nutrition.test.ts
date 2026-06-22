import { describe, it, expect } from '@jest/globals';
import { computeBMR, computeNutrition, ageFromBirthDate } from '../lib/nutrition';

describe('nutrition', () => {
  it('computeBMR (Mifflin-St-Jeor, maennlich)', () => {
    expect(computeBMR({ weightKg: 80, heightCm: 180, age: 30, gender: 'male', activity: 'moderate', goal: 'general_fitness' })).toBe(1780);
  });

  it('computeBMR: Geschlechts-Offset (male - female = 166)', () => {
    const base = { weightKg: 70, heightCm: 170, age: 30, activity: 'moderate' as const, goal: 'general_fitness' as const };
    const male = computeBMR({ ...base, gender: 'male' });
    const female = computeBMR({ ...base, gender: 'female' });
    expect(male - female).toBe(166); // 5 - (-161)
  });

  it('ageFromBirthDate: null/undefined -> Fallback 30', () => {
    expect(ageFromBirthDate(null)).toBe(30);
    expect(ageFromBirthDate(undefined)).toBe(30);
  });

  it('computeNutrition: general_fitness = Erhaltung, Felder gesetzt', () => {
    const r = computeNutrition({ weightKg: 80, heightCm: 180, age: 30, gender: 'male', activity: 'moderate', goal: 'general_fitness' });
    expect(r.targetCalories).toBe(2759); // round(1780 * 1.55)
    expect(r.proteinG).toBe(128);        // round(80 * 1.6)
    expect(r.carbsG).toBeGreaterThan(0);
    expect(r.fatG).toBeGreaterThan(0);
  });

  it('computeNutrition: Sicherheits-Untergrenze >= 1200 (weiblich)', () => {
    const r = computeNutrition({ weightKg: 45, heightCm: 150, age: 30, gender: 'female', activity: 'sedentary', goal: 'lose_weight' });
    expect(r.targetCalories).toBeGreaterThanOrEqual(1200);
  });

  it('computeNutrition: Abnehmen < Erhaltung < Aufbau', () => {
    const base = { weightKg: 80, heightCm: 180, age: 30, gender: 'male' as const, activity: 'moderate' as const };
    const maint = computeNutrition({ ...base, goal: 'general_fitness' }).targetCalories;
    const cut = computeNutrition({ ...base, goal: 'lose_weight' }).targetCalories;
    const bulk = computeNutrition({ ...base, goal: 'build_muscle' }).targetCalories;
    expect(cut).toBeLessThan(maint);
    expect(bulk).toBeGreaterThan(maint);
  });
});
