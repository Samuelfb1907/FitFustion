// Optionale Haushalts-Portion eines Lebensmittels, damit man im Tracker per
// STUECK / Scheibe / EL / Glas / Handvoll ... statt nur in Gramm eintragen kann
// ("2 Eier" statt "116 g"). Bewusst heuristisch per Name/Kategorie (wie foodUnit.ts)
// -> KEINE DB-Spalte, keine Migration. Gibt null zurueck, wenn keine sinnvolle
// Einheit passt (dann nur g/ml).

export type FoodPortion = { unitKey: string; grams: number };

// Reihenfolge = Prioritaet: die erste passende Regel gewinnt. Wortgrenzen (\b) verhindern
// Fehltreffer (z. B. "Apfelsaft"/"Orangensaft"/"Reis" werden NICHT als Stueck/Kugel erkannt).
const RULES: { re: RegExp; unitKey: string; grams: number }[] = [
  // Tasse: Heissgetraenke.
  { re: /(kaffee|espresso|cappuccino|latte|milchkaffee|\btee\b|kakao)/i, unitKey: 'food.unit.cup', grams: 200 },
  // Stueck: Broetchen/Croissant VOR der Brot-Regel.
  { re: /(brötchen|broetchen|semmel|weckle|laugenstange|croissant)/i, unitKey: 'food.unit.piece', grams: 60 },
  // Stueck: Riegel.
  { re: /(proteinriegel|müsliriegel|muesliriegel|riegel)/i, unitKey: 'food.unit.piece', grams: 60 },
  // Scheibe: harte, geschnittene Kaese-Sorten.
  { re: /(gouda|emmentaler|cheddar|edamer|butterkäse|butterkaese|scheibenkäse|scheibenkaese|harzer)/i, unitKey: 'food.unit.slice', grams: 30 },
  // Scheibe: Toast & alle *brot (nicht Broetchen: "bröt" != "brot").
  { re: /(toast|brot\b)/i, unitKey: 'food.unit.slice', grams: 30 },
  // Stueck: ganze Eier / Spiegelei (NICHT Eiklar/Ruehrei).
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
  // Handvoll: Nuesse.
  { re: /(mandeln|walnüsse|walnuesse|cashew|haselnüsse|haselnuesse|erdnüsse|erdnuesse|pistazien|studentenfutter|\bnüsse\b|\bnuesse\b)/i, unitKey: 'food.unit.handful', grams: 30 },
  // Kugel: Eis (NICHT Reis! -> nur explizite Eis-Sorten).
  { re: /(vanilleeis|schokoeis|erdbeereis|speiseeis|eiscreme)/i, unitKey: 'food.unit.scoop', grams: 50 },
  // EL: Oele.
  { re: /(olivenöl|olivenoel|rapsöl|rapsoel|kokosöl|kokosoel|sonnenblumenöl|leinöl|(öl|oel)\b)/i, unitKey: 'food.unit.tbsp', grams: 10 },
  // EL: Aufstriche & Saucen.
  { re: /(honig|marmelade|konfitüre|konfituere|erdnussbutter|nuss-nougat|nougat-creme|nutella|ketchup|mayonnaise|\bsenf\b|pesto|hummus)/i, unitKey: 'food.unit.tbsp', grams: 15 },
  // TL: Zucker.
  { re: /zucker/i, unitKey: 'food.unit.tsp', grams: 5 },
];

export function foodPortion(
  food?: { name?: string | null; category?: string | null } | null,
): FoodPortion | null {
  const name = (food?.name ?? '').toLowerCase();
  if (!name) return null;
  for (const r of RULES) {
    if (r.re.test(name)) return { unitKey: r.unitKey, grams: r.grams };
  }
  // Getraenke (ausser Pulver/Whey) -> Glas (200 ml). Kaffee/Tee greift schon oben als Tasse.
  if ((food?.category ?? '') === 'Getränke' && !/pulver|powder|whey/i.test(name)) {
    return { unitKey: 'food.unit.glass', grams: 200 };
  }
  return null;
}
