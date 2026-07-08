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

  it('computeNutrition: manuelles Ziel ueberschreibt Berechnung, Makros passen sich an', () => {
    const base = { weightKg: 80, heightCm: 180, age: 30, gender: 'male' as const, activity: 'moderate' as const, goal: 'general_fitness' as const };
    const auto = computeNutrition(base);
    const custom = computeNutrition(base, 2000);
    expect(custom.targetCalories).toBe(2000);          // manuelles Ziel gewinnt
    expect(custom.proteinG).toBe(auto.proteinG);        // Eiweiss bleibt gewichtsbasiert
    expect(custom.fatG).toBe(Math.round((2000 * 0.25) / 9)); // Fett = 25 % der neuen Kalorien
    expect(custom.proteinG * 4 + custom.carbsG * 4 + custom.fatG * 9).toBeLessThanOrEqual(2010);
  });

  it('computeNutrition: manuelles Ziel wird auf 800..8000 begrenzt; null/0 = automatisch', () => {
    const base = { weightKg: 80, heightCm: 180, age: 30, gender: 'male' as const, activity: 'moderate' as const, goal: 'general_fitness' as const };
    expect(computeNutrition(base, 50).targetCalories).toBe(800);
    expect(computeNutrition(base, 99999).targetCalories).toBe(8000);
    expect(computeNutrition(base, null).targetCalories).toBe(computeNutrition(base).targetCalories);
    expect(computeNutrition(base, 0).targetCalories).toBe(computeNutrition(base).targetCalories);
  });

  it('computeNutrition: restingBase nutzt Ruhe-Faktor 1.2 statt Aktivitaetsfaktor (niedriger)', () => {
    // Schrittzaehler aktiv -> Basis nur Ruheumsatz, weil Schritte/Training separat oben drauf kommen.
    const base = { weightKg: 82, heightCm: 180, age: 24, gender: 'male' as const, activity: 'light' as const, goal: 'lose_weight' as const };
    const lifestyle = computeNutrition(base).targetCalories;                              // 1830 * 1.375 * 0.8 = 2013
    const resting = computeNutrition(base, null, { restingBase: true }).targetCalories;   // 1830 * 1.2   * 0.8 = 1757
    expect(lifestyle).toBe(2013);
    expect(resting).toBe(1757);
    expect(resting).toBeLessThan(lifestyle);
  });
});
