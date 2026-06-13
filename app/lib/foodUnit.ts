// Anzeige-Einheit eines Lebensmittels: Getraenke in Millilitern (ml), alles andere in Gramm (g).
// Bewusst heuristisch (Kategorie + Name) – so braucht es KEINE DB-Spalte und keine Migration:
// die "category" wird in der App ohnehin ueberall mitgeladen. 1 ml Getraenk ~ 1 g, daher bleibt
// der gespeicherte Mengenwert gleich; wir zeigen ihn fuer Getraenke nur als ml an.

// Klare Getraenke-Woerter (DE + EN, fuer KI-/Barcode-/eigene Eintraege ohne Kategorie).
const NAME_LIQUID = /(milch|buttermilch|kefir|saft|cola|limo|limonade|brause|wasser|tee|kaffee|bier|wein|smoothie|schorle|nektar|sekt|prosecco|latte|cappuccino|espresso|kakao|energydrink|energy.?drink|softdrink|\bdrink\b|shake|cocktail|juice|\bmilk\b|\bwater\b|\btea\b|coffee|\bbeer\b|\bwine\b|\bsoda\b|lemonade)/i;
// Feste Lebensmittel, die zufaellig ein Getraenke-Wort enthalten -> bleiben Gramm.
const NAME_SOLID = /(schoko|reis|\bbrot\b|brötchen|broetchen|riegel|schnitte|pudding|creme|crème|quark|joghurt|yogurt|skyr|käse|kaese|cheese|pulver|powder|müsli|muesli|kuchen|keks|cookie)/i;

export function isLiquidFood(food?: { name?: string | null; category?: string | null } | null): boolean {
  if (!food) return false;
  const name = food.name ?? '';
  // Kategorie hat Vorrang: in "Getränke" ist alles fluessig – ausser Pulver (z. B. Whey).
  if ((food.category ?? '') === 'Getränke') return !/pulver|powder/i.test(name);
  if (NAME_SOLID.test(name)) return false;
  return NAME_LIQUID.test(name);
}

// 'g' oder 'ml' fuer die Anzeige.
export function foodUnit(food?: { name?: string | null; category?: string | null } | null): 'g' | 'ml' {
  return isLiquidFood(food) ? 'ml' : 'g';
}
