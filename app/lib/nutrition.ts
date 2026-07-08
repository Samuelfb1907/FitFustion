// Berechnung von Kalorien- und Makrobedarf.
// Reine Funktionen (kein UI, keine DB) -> leicht testbar und wiederverwendbar.
// Grundlage: Mifflin-St-Jeor-Formel (anerkannter Standard zur Schätzung des Grundumsatzes).

export type Gender = 'male' | 'female' | 'diverse' | 'prefer_not';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type GoalType =
  | 'lose_weight'
  | 'build_muscle'
  | 'gain_strength'
  | 'endurance'
  | 'general_fitness'
  | 'get_defined';

export type NutritionInput = {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: Gender;
  activity: ActivityLevel;
  goal: GoalType;
};

export type NutritionResult = {
  bmr: number;            // Grundumsatz (Ruhe-Energiebedarf)
  tdee: number;           // Gesamtumsatz (Erhaltungskalorien)
  targetCalories: number; // Zielkalorien je nach Ziel
  proteinG: number;
  carbsG: number;
  fatG: number;
};

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Grundumsatz (BMR) nach Mifflin-St Jeor
export function computeBMR(i: NutritionInput): number {
  const base = 10 * i.weightKg + 6.25 * i.heightCm - 5 * i.age;
  let constant: number;
  if (i.gender === 'male') constant = 5;
  else if (i.gender === 'female') constant = -161;
  else constant = -78; // Mittelwert fuer divers / keine Angabe
  return base + constant;
}

// Alter aus Geburtsdatum (Fallback 30, falls unbekannt)
export function ageFromBirthDate(birthDate: string | null | undefined): number {
  if (!birthDate) return 30;
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  if (age < 10 || age > 120) return 30;
  return age;
}

// overrideCalories: optionales, vom Nutzer manuell gesetztes Tagesziel. Wenn gesetzt, ersetzt
// es die Berechnung (die Makros passen sich an: Eiweiss bleibt gewichtsbasiert, Fett = 25 %,
// Rest = Kohlenhydrate). Harte Sicherheits-Spanne 800..8000 kcal.
export function computeNutrition(i: NutritionInput, overrideCalories?: number | null): NutritionResult {
  const bmr = computeBMR(i);
  const tdee = bmr * ACTIVITY_FACTORS[i.activity];

  // Zielkalorien je nach Ziel
  let factor: number;
  switch (i.goal) {
    case 'lose_weight': factor = 0.8; break;    // ~20 % Defizit
    case 'get_defined': factor = 0.85; break;   // ~15 % Defizit
    case 'build_muscle': factor = 1.15; break;  // ~15 % Ueberschuss
    case 'gain_strength': factor = 1.1; break;  // ~10 % Ueberschuss
    case 'endurance':
    case 'general_fitness':
    default: factor = 1.0; break;                // Erhaltung
  }
  let targetCalories = Math.round(tdee * factor);

  // Sicherheits-Untergrenze (kein ungesundes Defizit)
  const minCalories = i.gender === 'female' ? 1200 : 1500;
  if (targetCalories < minCalories) targetCalories = minCalories;

  // Manuelles Ziel hat Vorrang.
  if (overrideCalories != null && isFinite(Number(overrideCalories)) && Number(overrideCalories) > 0) {
    targetCalories = Math.min(8000, Math.max(800, Math.round(Number(overrideCalories))));
  }

  // Eiweissbedarf abhaengig vom Ziel (g pro kg Koerpergewicht)
  let proteinPerKg: number;
  if (i.goal === 'lose_weight' || i.goal === 'get_defined') proteinPerKg = 2.2;
  else if (i.goal === 'build_muscle' || i.goal === 'gain_strength') proteinPerKg = 2.0;
  else proteinPerKg = 1.6;

  const proteinG = Math.round(i.weightKg * proteinPerKg);
  const fatG = Math.round((targetCalories * 0.25) / 9); // 25 % der Kalorien aus Fett
  const proteinKcal = proteinG * 4;
  const fatKcal = fatG * 9;
  let carbsKcal = targetCalories - proteinKcal - fatKcal;
  if (carbsKcal < 0) carbsKcal = 0; // Rest = Kohlenhydrate
  const carbsG = Math.round(carbsKcal / 4);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories,
    proteinG,
    carbsG,
    fatG,
  };
}

// Grobe Schaetzung der bei Krafttraining verbrannten Kalorien (MET 3.5 =
// "allgemeines Gewichtstraining mit Satzpausen", Compendium 02054; deckt sich mit
// Lifesum/MyFitnessPal). kcal = MET * kg * Stunden. Nur eine Orientierung, damit das
// Tagesziel an Trainingstagen mitwaechst ("mehr trainiert -> mehr essen").
export function estimateWorkoutKcal(weightKg: number, minutes: number): number {
  if (!weightKg || !minutes) return 0;
  const hours = Math.min(360, Math.max(0, minutes)) / 60;
  return Math.round(3.5 * weightKg * hours);
}
