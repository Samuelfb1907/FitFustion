// Geburtsdatum aus drei Feldern (TT/MM/JJJJ) bauen & validieren.
// Gibt ein gueltiges ISO-Datum "YYYY-MM-DD" zurueck oder null bei ungueltiger Eingabe.
export function buildBirthDate(day: string, month: string, year: string): string | null {
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (!d || !m || !y) return null;
  const nowYear = new Date().getFullYear();
  if (y < 1900 || y > nowYear - 5) return null; // mind. ~5 Jahre alt, kein Tippfehler-Jahr
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  // echtes Kalenderdatum? (faengt z. B. 31.02. oder 30.02. ab)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  if (dt.getTime() > Date.now()) return null; // nicht in der Zukunft
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Zerlegt "YYYY-MM-DD" in {day, month, year} (fuer das Vorbefuellen im Profil).
export function splitBirthDate(iso: string | null | undefined): { day: string; month: string; year: string } {
  const empty = { day: '', month: '', year: '' };
  if (!iso) return empty;
  const mt = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!mt) return empty;
  return { year: mt[1], month: String(parseInt(mt[2], 10)), day: String(parseInt(mt[3], 10)) };
}
