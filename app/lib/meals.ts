// Mahlzeiten-Typen fuer das Essens-Tagebuch (Tracker & Rezepte).
// (Der fruehere Ernaehrungsplan-Generator wurde entfernt.)
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snack',
};

const ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

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
