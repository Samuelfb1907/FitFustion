// Kleine Formatierungs-/Hilfsfunktionen, die in mehreren Screens gebraucht werden.

// 12530 -> "12.530" (deutsche Tausenderpunkte). Vorzeichen separat behandeln,
// damit auch negative Zahlen korrekt gruppiert werden.
export function grp(n: number): string {
  const r = Math.round(n);
  const s = Math.abs(r).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return r < 0 ? '-' + s : s;
}

// Eine eingebettete Supabase-Relation kann Objekt ODER Array sein -> sicher das
// einzelne Objekt herausholen (null, wenn nichts da ist).
export function unwrap<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}
