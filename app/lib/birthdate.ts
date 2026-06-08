// Geburtsdatum aus drei Feldern (TT/MM/JJJJ) bauen & validieren.
// Mindestalter passend zum Haftungsausschluss/Gesundheitshinweis (legal.ts: 18+).
// Soll das Mindestalter geaendert werden, hier EINE Zahl anpassen (und ggf. den
// Text in legal.ts angleichen).
export const MIN_AGE_YEARS = 18;

// Reines Datum parsen + Kalender-/Plausibilitaetspruefung (OHNE Altersgrenze).
function parseBirthDate(day: string, month: string, year: string): Date | null {
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (!d || !m || !y) return null;
  const nowYear = new Date().getFullYear();
  if (y < 1900 || y > nowYear) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  // echtes Kalenderdatum? (faengt z. B. 31.02. oder 30.02. ab)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  if (dt.getTime() > Date.now()) return null; // nicht in der Zukunft
  return dt;
}

// Vollendetes Alter in Jahren zu einem Geburtsdatum.
function ageOf(dt: Date): number {
  const now = new Date();
  let age = now.getFullYear() - dt.getFullYear();
  const beforeBirthday =
    now.getMonth() < dt.getMonth() || (now.getMonth() === dt.getMonth() && now.getDate() < dt.getDate());
  if (beforeBirthday) age--;
  return age;
}

// Gibt ein gueltiges ISO-Datum "YYYY-MM-DD" zurueck - oder null bei ungueltiger
// Eingabe ODER wenn die Person juenger als MIN_AGE_YEARS ist.
export function buildBirthDate(day: string, month: string, year: string): string | null {
  const dt = parseBirthDate(day, month, year);
  if (!dt) return null;
  if (ageOf(dt) < MIN_AGE_YEARS) return null;
  const y = dt.getFullYear();
  const m = dt.getMonth() + 1;
  const d = dt.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// true, wenn das Datum gueltig ist, die Person aber juenger als MIN_AGE_YEARS ist
// (fuer eine praezise Fehlermeldung im Onboarding).
export function isUnderMinAge(day: string, month: string, year: string): boolean {
  const dt = parseBirthDate(day, month, year);
  return !!dt && ageOf(dt) < MIN_AGE_YEARS;
}

// Zerlegt "YYYY-MM-DD" in {day, month, year} (fuer das Vorbefuellen im Profil).
export function splitBirthDate(iso: string | null | undefined): { day: string; month: string; year: string } {
  const empty = { day: '', month: '', year: '' };
  if (!iso) return empty;
  const mt = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!mt) return empty;
  return { year: mt[1], month: String(parseInt(mt[2], 10)), day: String(parseInt(mt[3], 10)) };
}
