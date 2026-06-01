// Open Food Facts: kostenlose, offene Lebensmittel-Datenbank (kein API-Key noetig).
// Wir holen die Naehrwerte pro 100 g zu einem Barcode (EAN/UPC).
export type OffProduct = { name: string; kcal: number; protein: number; carbs: number; fat: number };

function num(v: any): number | null {
  const x = Number(v);
  return isFinite(x) ? x : null;
}
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export async function fetchOpenFoodFacts(barcode: string): Promise<OffProduct | null> {
  try {
    const url =
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json` +
      `?fields=product_name,product_name_de,brands,nutriments`;
    const res = await fetch(url, { headers: { 'User-Agent': 'FitFusion/1.0 (Expo Fitness App)' } });
    if (!res.ok) return null;
    const json: any = await res.json();
    if (json.status !== 1 || !json.product) return null;

    const p = json.product;
    const n = p.nutriments ?? {};
    const kcal = num(n['energy-kcal_100g']);
    if (kcal == null) return null; // ohne Kalorien fuer den Tracker unbrauchbar

    const baseName = String(p.product_name_de || p.product_name || '').trim();
    if (!baseName) return null;
    const brand = String(p.brands || '').split(',')[0]?.trim();
    const name = brand && !baseName.toLowerCase().includes(brand.toLowerCase()) ? `${baseName} (${brand})` : baseName;

    return {
      name: name.slice(0, 80),
      kcal: Math.round(kcal),
      protein: round1(num(n['proteins_100g']) ?? 0),
      carbs: round1(num(n['carbohydrates_100g']) ?? 0),
      fat: round1(num(n['fat_100g']) ?? 0),
    };
  } catch {
    return null;
  }
}
