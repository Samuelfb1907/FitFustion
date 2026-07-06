// Open Food Facts: kostenlose, offene Lebensmittel-Datenbank (kein API-Key noetig).
// Wir holen die Naehrwerte pro 100 g zu einem Barcode (EAN/UPC).
import { isLiquidFood } from './foodUnit';

export type OffProduct = { name: string; kcal: number; protein: number; carbs: number; fat: number; isLiquid: boolean };

// Getraenk erkennen: zuerst ueber die Open-Food-Facts-Kategorien (z. B. "en:energy-drinks",
// "en:beverages", "en:sodas") – zuverlaessiger als der Name (ein "Red Bull" hat kein Fluessig-Wort).
// "waters" trifft alle Wasser-Tags, aber NICHT "watercress" (Kresse). Milch/Tee/Kaffee/Cola faengt
// der Namens-Check (isLiquidFood) ab.
const OFF_BEVERAGE_TAG = /(drink|beverage|juice|soda|lemonade|smoothie|nectar|waters|iced-tea)/;
function offIsLiquid(categoriesTags: any, name: string): boolean {
  const joined = (Array.isArray(categoriesTags) ? categoriesTags.join(' ') : '').toLowerCase();
  return OFF_BEVERAGE_TAG.test(joined) || isLiquidFood({ name });
}

function num(v: any): number | null {
  const x = Number(v);
  return isFinite(x) ? x : null;
}
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export async function fetchOpenFoodFacts(barcode: string): Promise<OffProduct | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // nach 8 s abbrechen statt ewig haengen
  try {
    const url =
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json` +
      `?fields=product_name,product_name_de,brands,nutriments,categories_tags`;
    const res = await fetch(url, { headers: { 'User-Agent': 'FitAvo/1.0 (Expo Fitness App)' }, signal: controller.signal });
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

    // Auf die in der DB erlaubten Bereiche begrenzen (kcal 0..1000, Makros 0..100 pro 100 g),
    // damit fehlerhafte/Extremwerte (z. B. Crowd-Fehler) nicht am CHECK (23514) scheitern.
    const clamp = (v: number, hi: number) => Math.max(0, Math.min(hi, v));
    return {
      name: name.slice(0, 80),
      kcal: clamp(Math.round(kcal), 1000),
      protein: clamp(round1(num(n['proteins_100g']) ?? 0), 100),
      carbs: clamp(round1(num(n['carbohydrates_100g']) ?? 0), 100),
      fat: clamp(round1(num(n['fat_100g']) ?? 0), 100),
      isLiquid: offIsLiquid(p.categories_tags, name),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Freitext-Suche in der Open-Food-Facts-Datenbank (z. B. "Haferflocken").
// Liefert nur Treffer MIT Kalorien, nach Beliebtheit (meiste Scans) sortiert.
// Jeder Treffer traegt seinen Barcode (code) -> Auswahl laeuft ueber denselben
// Weg wie der Scan (resolveBarcodeFood).
export type OffSearchItem = { code: string; name: string; kcal: number; brand?: string };

export async function searchOpenFoodFacts(query: string, lang: 'de' | 'en' = 'de'): Promise<OffSearchItem[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // nach 8 s abbrechen
  try {
    // Deutsche Markt-Domain bevorzugt deutsche Produkte; sonst die Welt-Domain.
    const host = lang === 'en' ? 'https://world.openfoodfacts.org' : 'https://de.openfoodfacts.org';
    const url =
      `${host}/cgi/search.pl` +
      `?search_terms=${encodeURIComponent(q)}` +
      `&search_simple=1&action=process&json=1&page_size=24&sort_by=unique_scans_n` +
      `&fields=code,product_name,product_name_de,brands,nutriments`;
    const res = await fetch(url, { headers: { 'User-Agent': 'FitAvo/1.0 (Expo Fitness App)' }, signal: controller.signal });
    if (!res.ok) return [];
    const json: any = await res.json();
    const products: any[] = Array.isArray(json.products) ? json.products : [];
    const out: OffSearchItem[] = [];
    const seen = new Set<string>();
    for (const p of products) {
      const code = String(p.code || '').trim();
      if (!code) continue;
      const n = p.nutriments ?? {};
      const kcal = num(n['energy-kcal_100g']);
      if (kcal == null) continue; // ohne Kalorien fuer den Tracker unbrauchbar
      const baseName = String(
        (lang === 'en' ? p.product_name || p.product_name_de : p.product_name_de || p.product_name) || '',
      ).trim();
      if (!baseName) continue;
      const brand = String(p.brands || '').split(',')[0]?.trim() || undefined;
      const key = `${baseName.toLowerCase()}|${(brand ?? '').toLowerCase()}`;
      if (seen.has(key)) continue; // Doppelte (gleicher Name + Marke) ausblenden
      seen.add(key);
      out.push({
        code,
        name: baseName.slice(0, 80),
        kcal: Math.max(0, Math.min(1000, Math.round(kcal))),
        brand,
      });
      if (out.length >= 20) break;
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
