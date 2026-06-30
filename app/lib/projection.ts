// Ziel-Prognose: schaetzt aus dem Gewichtsverlauf, WANN das Zielgewicht erreicht wird.
// Lineare Regression (kleinste Quadrate) ueber die letzten ~60 Tage. Reine Funktion,
// keine DB/IO -> leicht testbar. Gibt null zurueck, wenn keine sinnvolle Prognose moeglich.
export type Projection =
  | { status: 'ok'; etaDate: string; perWeek: number }  // erreichbar: Datum (TT.MM.JJJJ) + kg/Woche
  | { status: 'no_trend' }                               // Tempo zeigt nicht Richtung Ziel
  | { status: 'far'; perWeek: number }                   // Richtung stimmt, dauert aber >3 Jahre
  | null;                                                 // zu wenig Daten / kein Ziel / schon erreicht

export function projectGoal(weights: { date: string; kg: number }[], target: number | null): Projection {
  if (target == null || weights.length < 3) return null;
  const last = weights[weights.length - 1];
  const current = last.kg;
  const remaining = target - current;
  if (Math.abs(remaining) <= 0.2) return null; // praktisch am Ziel

  // Fenster: letzte 60 Tage (sonst alle Eintraege).
  const lastMs = new Date(last.date).getTime();
  const WINDOW = 60 * 86400000;
  let pts = weights.filter((w) => lastMs - new Date(w.date).getTime() <= WINDOW);
  if (pts.length < 3) pts = weights;

  const t0 = new Date(pts[0].date).getTime();
  const spanDays = (lastMs - t0) / 86400000;
  if (spanDays < 7) return null; // zu kurzer Zeitraum fuer einen Trend

  // Lineare Regression: x = Tage seit t0, y = kg.
  const xs = pts.map((w) => (new Date(w.date).getTime() - t0) / 86400000);
  const ys = pts.map((w) => w.kg);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  if (den === 0) return null;
  const slope = num / den; // kg pro Tag

  const desired = Math.sign(remaining);
  if (Math.sign(slope) !== desired || Math.abs(slope) < 0.001) return { status: 'no_trend' };

  const days = remaining / slope; // positiv (Vorzeichen passen zusammen)
  const perWeek = Math.round(Math.abs(slope) * 7 * 10) / 10;
  if (days > 365 * 3) return { status: 'far', perWeek };

  const eta = new Date(lastMs + days * 86400000);
  const dd = String(eta.getDate()).padStart(2, '0');
  const mm = String(eta.getMonth() + 1).padStart(2, '0');
  return { status: 'ok', etaDate: `${dd}.${mm}.${eta.getFullYear()}`, perWeek };
}
