// Mahlzeiten-Bibliothek + Generator für den Tages-Ernährungsplan.
// Reine Logik (kein UI/DB). Allergen-Tags nutzen dieselben Schlüssel wie das Onboarding.

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type MealTemplate = {
  name: string;
  type: MealType;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  allergens: string[];
};

export type PlannedMeal = {
  type: MealType;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  portion: number; // Portionsfaktor (1 = Standardportion)
};

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snack',
};

// Kalorien-Verteilung über den Tag
const SHARE: Record<MealType, number> = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 };
const ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const MEALS: MealTemplate[] = [
  // Frühstück
  { name: 'Haferflocken mit Banane & Beeren', type: 'breakfast', kcal: 420, protein: 14, carbs: 72, fat: 8, allergens: ['gluten'] },
  { name: 'Rührei mit Vollkorntoast', type: 'breakfast', kcal: 380, protein: 24, carbs: 30, fat: 18, allergens: ['eggs', 'gluten'] },
  { name: 'Skyr mit Honig & Nüssen', type: 'breakfast', kcal: 350, protein: 28, carbs: 30, fat: 12, allergens: ['milk', 'lactose', 'tree_nuts'] },
  { name: 'Smoothie-Bowl mit Soja-Joghurt', type: 'breakfast', kcal: 360, protein: 12, carbs: 60, fat: 8, allergens: ['soy'] },
  { name: 'Reiswaffeln mit Erdnussbutter & Banane', type: 'breakfast', kcal: 400, protein: 14, carbs: 55, fat: 16, allergens: ['peanuts'] },
  { name: 'Frischer Obstsalat', type: 'breakfast', kcal: 260, protein: 4, carbs: 55, fat: 2, allergens: [] },
  // Mittagessen
  { name: 'Hähnchen mit Reis & Gemüse', type: 'lunch', kcal: 550, protein: 45, carbs: 60, fat: 12, allergens: [] },
  { name: 'Lachs mit Kartoffeln & Brokkoli', type: 'lunch', kcal: 600, protein: 40, carbs: 45, fat: 25, allergens: ['fish'] },
  { name: 'Vollkornnudeln mit Tomatensoße', type: 'lunch', kcal: 520, protein: 18, carbs: 90, fat: 10, allergens: ['gluten'] },
  { name: 'Linsen-Curry mit Reis', type: 'lunch', kcal: 500, protein: 22, carbs: 80, fat: 10, allergens: ['legumes'] },
  { name: 'Rindfleisch-Wrap', type: 'lunch', kcal: 580, protein: 35, carbs: 50, fat: 22, allergens: ['gluten'] },
  { name: 'Quinoa-Bowl mit Gemüse', type: 'lunch', kcal: 520, protein: 18, carbs: 78, fat: 14, allergens: [] },
  // Abendessen
  { name: 'Pute mit Süßkartoffel & Salat', type: 'dinner', kcal: 500, protein: 42, carbs: 45, fat: 14, allergens: [] },
  { name: 'Tofu-Pfanne mit Reis', type: 'dinner', kcal: 480, protein: 28, carbs: 60, fat: 14, allergens: ['soy'] },
  { name: 'Omelett mit Gemüse & Salat', type: 'dinner', kcal: 420, protein: 30, carbs: 12, fat: 26, allergens: ['eggs'] },
  { name: 'Garnelen mit Zucchininudeln', type: 'dinner', kcal: 380, protein: 35, carbs: 18, fat: 16, allergens: ['crustaceans'] },
  { name: 'Hähnchensalat mit Avocado', type: 'dinner', kcal: 450, protein: 38, carbs: 18, fat: 26, allergens: [] },
  { name: 'Gemüsepfanne mit Reis', type: 'dinner', kcal: 400, protein: 10, carbs: 70, fat: 9, allergens: [] },
  // Snack
  { name: 'Apfel & eine Handvoll Mandeln', type: 'snack', kcal: 220, protein: 6, carbs: 25, fat: 12, allergens: ['tree_nuts'] },
  { name: 'Magerquark mit Beeren', type: 'snack', kcal: 180, protein: 25, carbs: 15, fat: 2, allergens: ['milk', 'lactose'] },
  { name: 'Reiswaffeln mit Hummus', type: 'snack', kcal: 200, protein: 6, carbs: 30, fat: 6, allergens: ['legumes'] },
  { name: 'Banane & Reiscracker', type: 'snack', kcal: 200, protein: 3, carbs: 45, fat: 2, allergens: [] },
  { name: 'Gemüsesticks mit Guacamole', type: 'snack', kcal: 180, protein: 3, carbs: 18, fat: 12, allergens: [] },
];

// Erstellt einen Tagesplan: pro Mahlzeit eine allergikersichere Option,
// portioniert auf den jeweiligen Kalorien-Anteil des Tagesziels.
export function generateMealPlan(targetKcal: number, allergies: string[]): PlannedMeal[] {
  const out: PlannedMeal[] = [];
  for (const type of ORDER) {
    const safe = MEALS.filter((m) => m.type === type && !m.allergens.some((a) => allergies.includes(a)));
    if (safe.length === 0) continue; // keine sichere Option -> Mahlzeit auslassen
    const pick = safe[Math.floor(Math.random() * safe.length)];
    const mealTarget = targetKcal * SHARE[type];
    let portion = mealTarget / pick.kcal;
    portion = Math.max(0.5, Math.min(2.5, Math.round(portion * 10) / 10));
    out.push({
      type,
      name: pick.name,
      kcal: Math.round(pick.kcal * portion),
      protein: Math.round(pick.protein * portion),
      carbs: Math.round(pick.carbs * portion),
      fat: Math.round(pick.fat * portion),
      portion,
    });
  }
  return out;
}

// ----------------------------------------------------------------------------
//  Mahlzeiten-Tracking (Essens-Tagebuch) – teilt sich MealType + Labels oben
// ----------------------------------------------------------------------------
export const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅', lunch: '🍽️', dinner: '🌙', snack: '🍎',
};

// Reihenfolge + Icons fuer die Tagebuch-Abschnitte
export const TRACKER_MEALS: { key: MealType; label: string; icon: string }[] =
  ORDER.map((k) => ({ key: k, label: MEAL_TYPE_LABELS[k], icon: MEAL_ICONS[k] }));

// Vorschlag der Mahlzeit anhand der Uhrzeit.
export function mealByHour(d: Date = new Date()): MealType {
  const h = d.getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

// Unbekanntes/NULL -> 'snack', damit nichts verloren geht.
export function normalizeMeal(key: string | null | undefined): MealType {
  return ORDER.find((k) => k === key) ?? 'snack';
}
