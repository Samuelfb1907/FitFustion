import { describe, it, expect } from '@jest/globals';
import { projectGoal } from '../lib/projection';

// Lokales Datum (YYYY-MM-DD) mit Tages-Offset.
function dayStr(offset: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('projectGoal', () => {
  it('schaetzt ein Zieldatum bei passendem Abnehm-Trend', () => {
    const weights = [
      { date: dayStr(-28), kg: 80 },
      { date: dayStr(-14), kg: 79 },
      { date: dayStr(0), kg: 78 },
    ];
    const p = projectGoal(weights, 75);
    expect(p?.status).toBe('ok');
    if (p?.status === 'ok') {
      expect(typeof p.etaDate).toBe('string');
      expect(p.perWeek).toBeGreaterThan(0);
    }
  });

  it('meldet no_trend, wenn das Tempo in die falsche Richtung zeigt', () => {
    const weights = [
      { date: dayStr(-28), kg: 76 },
      { date: dayStr(-14), kg: 77 },
      { date: dayStr(0), kg: 78 },
    ];
    // Ziel niedriger (75), aber Gewicht steigt -> kein Trend Richtung Ziel.
    expect(projectGoal(weights, 75)?.status).toBe('no_trend');
  });

  it('gibt null ohne Ziel oder bei zu wenig Daten zurueck', () => {
    const weights = [
      { date: dayStr(-28), kg: 80 },
      { date: dayStr(-14), kg: 79 },
      { date: dayStr(0), kg: 78 },
    ];
    expect(projectGoal(weights, null)).toBeNull();
    expect(projectGoal([{ date: dayStr(0), kg: 80 }], 75)).toBeNull();
  });
});
