// Fortschritts-Historie EINER Uebung: die einzelnen Saetze (set_logs) nach Trainingseinheit
// (session_id) gruppieren, je Einheit den schwersten Satz ermitteln und den Trend gegenueber
// der vorigen (aelteren) Einheit berechnen -> gruen (up) / rot (down) / neutral (same).
// Reine Logik ohne Supabase-/UI-Code -> unit-testbar.

export type SetRow = { session_id: string; reps: number | null; weight_kg: number | null; created_at: string };
export type Trend = 'up' | 'down' | 'same';
export type HistoryEntry = {
  sessionId: string;
  dateMs: number;             // Zeitpunkt der Einheit (juengster Satz)
  topWeight: number | null;   // schwerstes Gewicht der Einheit
  repsAtTop: number | null;   // Wdh beim schwersten Satz
  maxReps: number | null;     // meiste Wdh (fuer Uebungen ohne Gewicht)
  trend: Trend | null;        // Vergleich zur naechst-aelteren Einheit; null = nicht vergleichbar
};

// Vergleicht zwei Einheiten: Gewicht zuerst, bei gleichem Gewicht mehr Wdh = besser.
// Ohne Gewicht (Bodyweight) zaehlen die Wdh. Rueckgabe >0 = a besser, <0 = a schlechter,
// 0 = gleich, null = nicht vergleichbar (einmal mit, einmal ohne Gewicht).
function compareEntries(a: HistoryEntry, b: HistoryEntry): number | null {
  const aw = a.topWeight, bw = b.topWeight;
  if (aw != null && bw != null) {
    if (aw !== bw) return aw - bw;
    return (a.repsAtTop ?? 0) - (b.repsAtTop ?? 0);
  }
  if (aw == null && bw == null) {
    if (a.maxReps == null || b.maxReps == null) return null;
    return a.maxReps - b.maxReps;
  }
  return null;
}

// rows: alle Saetze der Uebung (beliebige Reihenfolge). limit: wie viele Einheiten zurueckgeben.
// Ergebnis: neueste Einheit zuerst, jede mit Trend gegenueber der aelteren.
export function buildExerciseHistory(rows: SetRow[], limit = 8): HistoryEntry[] {
  const bySession = new Map<string, HistoryEntry>();
  for (const r of rows) {
    if (!r || !r.session_id) continue;
    const g = bySession.get(r.session_id) ?? {
      sessionId: r.session_id, dateMs: 0, topWeight: null, repsAtTop: null, maxReps: null, trend: null,
    };
    const ts = Date.parse(r.created_at);
    if (isFinite(ts) && ts > g.dateMs) g.dateMs = ts;
    const w = r.weight_kg;
    if (w != null && (g.topWeight == null || w > g.topWeight)) { g.topWeight = w; g.repsAtTop = r.reps ?? null; }
    if (r.reps != null && (g.maxReps == null || r.reps > g.maxReps)) g.maxReps = r.reps;
    bySession.set(r.session_id, g);
  }
  // Neueste zuerst. Trend auf der VOLLSTAENDIGEN Liste berechnen (auch die unterste sichtbare
  // Zeile bekommt so einen Vergleich zur naechsten, ggf. nicht mehr angezeigten Einheit).
  const all = [...bySession.values()].sort((x, y) => y.dateMs - x.dateMs);
  for (let i = 0; i < all.length; i++) {
    const older = i + 1 < all.length ? all[i + 1] : null;
    const d = older ? compareEntries(all[i], older) : null;
    all[i].trend = d == null ? null : d > 0 ? 'up' : d < 0 ? 'down' : 'same';
  }
  return all.slice(0, limit);
}
