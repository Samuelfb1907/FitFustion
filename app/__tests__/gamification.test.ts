import { describe, it, expect } from '@jest/globals';
import { computeXp, levelInfo, computeStreak, XP_PER_LEVEL } from '../lib/gamification';

// Lokales Datum (YYYY-MM-DD) mit Offset in Tagen - gleiche Bildung wie computeStreak.
function dayStr(offset: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('gamification', () => {
  it('computeXp gewichtet Sessions/Saetze/Logs', () => {
    expect(computeXp({ sessions: 2, sets: 10, foodLogs: 3, streak: 0, goalSet: false })).toBe(159); // 100 + 50 + 9
    expect(computeXp({ sessions: 0, sets: 0, foodLogs: 0, streak: 0, goalSet: false })).toBe(0);
  });

  it('levelInfo: Level + Fortschritt im Level', () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(XP_PER_LEVEL).level).toBe(2);
    const l = levelInfo(XP_PER_LEVEL * 2 + 100);
    expect(l.level).toBe(3);
    expect(l.intoLevel).toBe(100);
  });

  it('computeStreak: leere Liste -> 0', () => {
    expect(computeStreak([])).toBe(0);
  });

  it('computeStreak: nur heute -> 1', () => {
    expect(computeStreak([dayStr(0)])).toBe(1);
  });

  it('computeStreak: 3 Tage in Folge -> 3', () => {
    expect(computeStreak([dayStr(0), dayStr(-1), dayStr(-2)])).toBe(3);
  });

  it('computeStreak: 1 Tag Karenz (heute leer, gestern aktiv) -> 1', () => {
    expect(computeStreak([dayStr(-1)])).toBe(1);
  });

  it('computeStreak: heute aktiv, gestern Luecke, vorgestern aktiv -> 1', () => {
    expect(computeStreak([dayStr(0), dayStr(-2)])).toBe(1);
  });

  it('computeStreak: nur vorgestern (heute+gestern leer) -> 0', () => {
    expect(computeStreak([dayStr(-2)])).toBe(0);
  });
});
