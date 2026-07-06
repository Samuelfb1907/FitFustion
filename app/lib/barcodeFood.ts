// Loest einen gescannten Barcode zu einem foods-Eintrag auf:
//  1) schon in der DB (per Barcode)?  -> nehmen
//  2) bei Open Food Facts nachschlagen -> als neues Lebensmittel anlegen
//  3) Name-Konflikt mit vorhandenem Lebensmittel -> dieses nehmen
import { supabase } from './supabase';
import { fetchOpenFoodFacts } from './openFoodFacts';

export type FoodRow = { id: string; name: string; category: string | null; kcal: number; protein: number; carbs: number; fat: number };
export type ResolveResult = { food: FoodRow; created: boolean } | { food: null; reason: 'not_found' | 'error' };

const COLS = 'id, name, category, kcal, protein, carbs, fat';

export async function resolveBarcodeFood(userId: string, barcode: string, category = 'Gescannt'): Promise<ResolveResult> {
  // 1) Schon vorhanden (von dir oder jemand anderem gescannt)?
  const { data: existing } = await supabase.from('foods').select(COLS).eq('barcode', barcode).limit(1).maybeSingle();
  if (existing) return { food: existing as FoodRow, created: false };

  // 2) Open Food Facts
  const off = await fetchOpenFoodFacts(barcode);
  if (!off) return { food: null, reason: 'not_found' };

  // 3) Neu anlegen (mit Barcode + Besitzer). Getraenke kommen in die Kategorie "Getränke",
  //    damit sie in ml statt Gramm getrackt werden (z. B. Red Bull, Cola, Saft).
  const cat = off.isLiquid ? 'Getränke' : category;
  const { data: created, error } = await supabase
    .from('foods')
    .insert({ name: off.name, category: cat, kcal: off.kcal, protein: off.protein, carbs: off.carbs, fat: off.fat, barcode, user_id: userId })
    .select(COLS)
    .single();
  if (!error && created) return { food: created as FoodRow, created: true };

  // 4) Insert fehlgeschlagen: NUR bei Eindeutigkeits-Konflikt (23505) den vorhandenen
  //    Eintrag holen (bevorzugt per Barcode, sonst per Name). Andere Fehler -> 'error'.
  if (error && (error as any).code === '23505') {
    const { data: byBarcode } = await supabase.from('foods').select(COLS).eq('barcode', barcode).limit(1).maybeSingle();
    if (byBarcode) return { food: byBarcode as FoodRow, created: false };
    const { data: byName } = await supabase.from('foods').select(COLS).eq('name', off.name).limit(1).maybeSingle();
    if (byName) return { food: byName as FoodRow, created: false };
  }
  return { food: null, reason: 'error' };
}
