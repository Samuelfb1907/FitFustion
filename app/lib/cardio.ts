// Cardio-Kalorienschaetzung nach der MET-Methode (Metabolic Equivalent of Task):
//   kcal = MET * Koerpergewicht(kg) * Dauer(Stunden)
// MET-Werte aus dem "Compendium of Physical Activities" (moderate Intensitaet).
// Eine schwerere Person verbrennt mehr, weil das Gewicht direkt in die Formel eingeht.
// Reine Daten/Logik (kein UI, keine DB) -> leicht testbar und wiederverwendbar.

export type CardioType = { key: string; met: number; icon: string };

// Reihenfolge = Anzeige-Reihenfolge (Krafttraining zuerst, dann haeufigste Gym-Geraete).
// MET 3.5 fuer Krafttraining = "allgemeines Gewichtstraining, 8-15 Wdh mit Pausen"
// (Compendium of Physical Activities 02054). Deckt sich mit Lifesum/MyFitnessPal.
// MET 5.0 waere durchgehend hartes Heben - mit Satzpausen unrealistisch. Bleibt
// konsistent mit estimateWorkoutKcal (Set-Tracking), das ebenfalls 3.5 nutzt.
export const CARDIO_TYPES: CardioType[] = [
  { key: 'strength', met: 3.5, icon: 'barbell' },
  { key: 'treadmill', met: 8.5, icon: 'walk' },
  { key: 'running', met: 9.8, icon: 'body' },
  { key: 'walking', met: 3.5, icon: 'footsteps' },
  { key: 'cycling', met: 7.5, icon: 'bicycle' },
  { key: 'spinning', met: 8.5, icon: 'speedometer' },
  { key: 'elliptical', met: 5.0, icon: 'fitness' },
  { key: 'stairmaster', met: 9.0, icon: 'trending-up' },
  { key: 'rowing', met: 7.0, icon: 'boat' },
  { key: 'swimming', met: 8.0, icon: 'water' },
  { key: 'jump_rope', met: 11.0, icon: 'pulse' },
  { key: 'hiit', met: 8.0, icon: 'flame' },
  { key: 'hiking', met: 6.0, icon: 'trail-sign' },
  { key: 'boxing', met: 7.8, icon: 'barbell' },
  { key: 'dancing', met: 5.0, icon: 'musical-notes' },
];

export function cardioTypeByKey(key: string): CardioType | undefined {
  return CARDIO_TYPES.find((x) => x.key === key);
}

// Verbrannte Kalorien fuer eine Einheit. Minuten werden auf [0, 600] (max 10 h)
// begrenzt, damit Fehleingaben nicht zu absurden Werten fuehren.
export function cardioKcal(met: number, weightKg: number, minutes: number): number {
  if (!met || !weightKg || !minutes || minutes <= 0) return 0;
  const m = Math.min(600, Math.max(0, minutes));
  return Math.round(met * weightKg * (m / 60));
}
