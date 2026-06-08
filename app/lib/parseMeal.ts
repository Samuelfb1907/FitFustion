// Ruft die Edge Function "parse-meal" auf: deutscher Mahlzeit-Satz -> strukturierte Eintraege.
// Der Claude-Key liegt serverseitig; hier geht nur der Satz (+ Standard-Mahlzeit) raus.
import { supabase } from './supabase';
import { MealType } from './meals';

export type ParsedItem = {
  name: string;
  amount_g: number;
  meal_type: MealType;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function clamp(v: unknown, lo: number, hi: number): number {
  const n = Number(v);
  if (!isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export async function parseMeal(text: string, defaultMeal: MealType): Promise<ParsedItem[]> {
  const { data, error } = await supabase.functions.invoke('parse-meal', {
    body: { text: text.trim().slice(0, 500), defaultMeal },
  });
  if (error) throw error;
  if (data && (data as any).error) throw new Error((data as any).error);
  const raw = Array.isArray((data as any)?.items) ? (data as any).items : [];
  return raw
    .filter((i: any) => i && typeof i.name === 'string' && Number(i.amount_g) > 0)
    .slice(0, 25)
    .map((i: any) => ({
      name: String(i.name).trim().slice(0, 80),
      amount_g: clamp(i.amount_g, 1, 100000),
      meal_type: (MEALS.includes(i.meal_type) ? i.meal_type : defaultMeal) as MealType,
      kcal: clamp(i.kcal, 0, 1000),
      protein: clamp(i.protein, 0, 100),
      carbs: clamp(i.carbs, 0, 100),
      fat: clamp(i.fat, 0, 100),
    }));
}
