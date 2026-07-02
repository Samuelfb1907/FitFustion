// Optionale Haushalts-Portion eines Lebensmittels, damit man im Tracker per
// STUECK / Scheibe / EL statt nur in Gramm eintragen kann ("2 Eier" statt "116 g").
// Bewusst heuristisch per Name (wie foodUnit.ts) -> KEINE DB-Spalte, keine Migration.
// Gibt null zurueck, wenn keine sinnvolle Stueck-Einheit passt (dann nur g/ml).

export type FoodPortion = { unitKey: string; grams: number };

// Reihenfolge = Prioritaet: die erste passende Regel gewinnt. Bewusst mit Wortgrenzen (\b),
// damit z. B. "Apfelsaft"/"Orangensaft"/"Tomatensauce" NICHT als Stueck erkannt werden.
const RULES: { re: RegExp; unitKey: string; grams: number }[] = [
  // Broetchen/Semmel/Croissant VOR der Brot-Regel pruefen.
  { re: /(brötchen|broetchen|semmel|weckle|laugenstange|croissant)/i, unitKey: 'food.unit.piece', grams: 60 },
  // Scheibe: Toast & alle *brot (aber nicht Broetchen: "bröt" != "brot").
  { re: /(toast|brot\b)/i, unitKey: 'food.unit.slice', grams: 30 },
  // Stueck: ganze Eier / Spiegelei (NICHT Eiklar oder Ruehrei).
  { re: /(spiegelei|\bei\b|\beier\b)/i, unitKey: 'food.unit.piece', grams: 58 },
  // Stueck: Obst & Gemuese, die man als ganzes Stueck isst.
  { re: /banane\b/i, unitKey: 'food.unit.piece', grams: 120 },
  { re: /(apfel|äpfel|aepfel)\b/i, unitKey: 'food.unit.piece', grams: 130 },
  { re: /(orange|mandarine|clementine)\b/i, unitKey: 'food.unit.piece', grams: 130 },
  { re: /birne\b/i, unitKey: 'food.unit.piece', grams: 150 },
  { re: /kiwi\b/i, unitKey: 'food.unit.piece', grams: 75 },
  { re: /tomate\b/i, unitKey: 'food.unit.piece', grams: 90 },
  { re: /(karotte|karrotte|möhre|moehre)\b/i, unitKey: 'food.unit.piece', grams: 60 },
  { re: /paprika\b/i, unitKey: 'food.unit.piece', grams: 120 },
  { re: /avocado\b/i, unitKey: 'food.unit.piece', grams: 140 },
  // EL: Oele.
  { re: /(olivenöl|olivenoel|rapsöl|rapsoel|kokosöl|kokosoel|sonnenblumenöl|leinöl|(öl|oel)\b)/i, unitKey: 'food.unit.tbsp', grams: 10 },
  // EL: Aufstriche & Saucen.
  { re: /(honig|marmelade|konfitüre|konfituere|erdnussbutter|nuss-nougat|nougat-creme|nutella|ketchup|mayonnaise|\bsenf\b|pesto|hummus)/i, unitKey: 'food.unit.tbsp', grams: 15 },
];

export function foodPortion(
  food?: { name?: string | null; category?: string | null } | null,
): FoodPortion | null {
  const name = (food?.name ?? '').toLowerCase();
  if (!name) return null;
  for (const r of RULES) {
    if (r.re.test(name)) return { unitKey: r.unitKey, grams: r.grams };
  }
  return null;
}
