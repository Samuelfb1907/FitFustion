// Realistische Einordnung eines Abnehmziels (rein, testbar – kein UI/DB).
// Gesundes, haltbares Tempo gilt allgemein als 0,5–1,0 kg pro Woche. Schneller ist
// selten haltbar (Muskelabbau, Jojo). Diese Funktion liefert die Fakten; die Anzeige-
// texte/Warnungen bauen die Screens daraus zusammen (ProfileScreen, OnboardingScreen).

export type GoalRealism = {
  kgToLose: number;            // > 0,5 (sonst null)
  perWeek: number | null;      // nur wenn ein Zeitrahmen bekannt ist (Onboarding): kg/Woche
  tooFast: boolean;            // perWeek > 1,0 kg/Woche
  ambitious: boolean;          // Gesamtmenge > 15 % des Koerpergewichts (mengenbasiert)
  minWeeks: number;            // Dauer bei ~1,0 kg/Woche
  maxWeeks: number;            // Dauer bei ~0,5 kg/Woche
  belowHealthyBmi: boolean;    // Zielgewicht unter BMI 18,5 (nur wenn Groesse bekannt)
};

const PACE_MAX = 1.0; // gesundes Maximum kg/Woche
const PACE_MIN = 0.5; // sanftes Tempo kg/Woche

export function goalRealism(
  currentKg: number,
  targetKg: number,
  opts?: { weeks?: number | null; heightCm?: number | null }
): GoalRealism | null {
  if (!currentKg || !targetKg || currentKg <= 0 || targetKg <= 0) return null;
  const kgToLose = Math.round((currentKg - targetKg) * 10) / 10;
  if (kgToLose <= 0.5) return null; // kein nennenswertes Abnehmziel (oder Zunahme)

  const minWeeks = Math.max(1, Math.ceil(kgToLose / PACE_MAX));
  const maxWeeks = Math.max(minWeeks, Math.ceil(kgToLose / PACE_MIN));

  const weeks = opts?.weeks;
  const perWeek = weeks && weeks > 0 ? Math.round((kgToLose / weeks) * 100) / 100 : null;
  const tooFast = perWeek != null && perWeek > PACE_MAX + 0.001;

  const ambitious = kgToLose / currentKg > 0.15;

  let belowHealthyBmi = false;
  const h = opts?.heightCm;
  if (h && h >= 100) {
    const m = h / 100;
    belowHealthyBmi = targetKg / (m * m) < 18.5;
  }

  return { kgToLose, perWeek, tooFast, ambitious, minWeeks, maxWeeks, belowHealthyBmi };
}
