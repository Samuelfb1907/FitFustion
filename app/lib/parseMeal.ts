// Ruft die Edge Function "parse-meal" auf: Mahlzeit als TEXT ("2 Eier, ein Toast") ODER als FOTO
// -> strukturierte Tagebuch-Eintraege. Der Claude-Key liegt serverseitig; hier geht nur der
// Satz bzw. das (verkleinerte) Bild raus.
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

// Typisierter Fehler, damit die UI z. B. das Tageslimit (429) freundlich anzeigen kann.
export class ParseMealError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ParseMealError';
    this.code = code;
  }
}

function clamp(v: unknown, lo: number, hi: number): number {
  const n = Number(v);
  if (!isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

// Antwort der Edge Function in saubere, begrenzte ParsedItems verwandeln.
function normalize(data: unknown, defaultMeal: MealType): ParsedItem[] {
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

// Gemeinsamer Aufruf + Fehlerbehandlung fuer Text- und Foto-Modus.
async function invokeParse(body: Record<string, unknown>, defaultMeal: MealType): Promise<ParsedItem[]> {
  const { data, error } = await supabase.functions.invoke('parse-meal', { body });
  if (error) {
    // Bei Nicht-200 (z. B. 429 Tageslimit) steckt der JSON-Body in error.context.
    const ctx: any = (error as any).context;
    let info: any = null;
    if (ctx && typeof ctx.json === 'function') { try { info = await ctx.json(); } catch { info = null; } }
    if (info?.error === 'rate_limited') {
      throw new ParseMealError('rate_limited', info.message || 'Tageslimit fuer KI-Analysen erreicht. Bitte morgen erneut versuchen.');
    }
    if (info?.error === 'premium_required') {
      throw new ParseMealError('premium_required', info.message || 'Die KI-Erkennung ist Teil von FitAvo Premium.');
    }
    throw error;
  }
  if (data && (data as any).error) throw new Error((data as any).error);
  return normalize(data, defaultMeal);
}

// Text-Modus: ein Mahlzeit-Satz.
export async function parseMeal(text: string, defaultMeal: MealType, lang: 'de' | 'en' = 'de'): Promise<ParsedItem[]> {
  return invokeParse({ text: text.trim().slice(0, 500), defaultMeal, lang }, defaultMeal);
}

// Foto-Modus: Base64-Bild (vom Client bereits verkleinert) + Medientyp.
export async function parseMealPhoto(
  imageBase64: string,
  imageType: string,
  defaultMeal: MealType,
  lang: 'de' | 'en' = 'de',
): Promise<ParsedItem[]> {
  return invokeParse({ image: imageBase64, imageType, defaultMeal, lang }, defaultMeal);
}
