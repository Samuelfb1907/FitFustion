import { describe, it, expect } from '@jest/globals';
import { buildExerciseHistory, SetRow } from '../lib/exerciseHistory';

// Kleiner Helfer: ein Satz an einem bestimmten Tag.
const set = (session: string, day: string, weight: number | null, reps: number | null): SetRow => ({
  session_id: session, weight_kg: weight, reps, created_at: `2026-06-${day}T10:00:00Z`,
});

describe('buildExerciseHistory', () => {
  it('gruppiert nach Trainingseinheit, neueste zuerst, schwerster Satz je Einheit', () => {
    const rows: SetRow[] = [
      set('s1', '01', 10, 8), set('s1', '01', 12, 5),   // Einheit 1: top 12
      set('s2', '08', 15, 5),                            // Einheit 2: top 15
    ];
    const h = buildExerciseHistory(rows);
    expect(h.map((e) => e.sessionId)).toEqual(['s2', 's1']); // neueste zuerst
    expect(h[0].topWeight).toBe(15);
    expect(h[1].topWeight).toBe(12);
  });

  it('mehr Gewicht als letztes Mal = up (gruen), weniger = down (rot)', () => {
    const rows: SetRow[] = [
      set('s1', '01', 10, 8),
      set('s2', '08', 15, 8),
      set('s3', '15', 12, 8),
    ];
    const h = buildExerciseHistory(rows); // Reihenfolge: s3(12), s2(15), s1(10)
    expect(h[0].trend).toBe('down'); // 12 < 15
    expect(h[1].trend).toBe('up');   // 15 > 10
    expect(h[2].trend).toBe(null);   // aeltester -> kein Vergleich
  });

  it('gleiches Gewicht, aber mehr Wdh = up', () => {
    const rows: SetRow[] = [set('s1', '01', 20, 5), set('s2', '08', 20, 8)];
    const h = buildExerciseHistory(rows);
    expect(h[0].trend).toBe('up');
  });

  it('ohne Gewicht (Bodyweight): Wdh entscheiden', () => {
    const rows: SetRow[] = [set('s1', '01', null, 10), set('s2', '08', null, 14)];
    const h = buildExerciseHistory(rows);
    expect(h[0].topWeight).toBe(null);
    expect(h[0].maxReps).toBe(14);
    expect(h[0].trend).toBe('up');
  });

  it('limit begrenzt die Anzahl der Einheiten', () => {
    const rows: SetRow[] = Array.from({ length: 12 }, (_, i) =>
      set(`s${i}`, String(i + 1).padStart(2, '0'), 10 + i, 5));
    expect(buildExerciseHistory(rows, 5)).toHaveLength(5);
  });
});
