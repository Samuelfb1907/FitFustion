import { describe, it, expect } from '@jest/globals';
import { goalRealism } from '../lib/goalRealism';

describe('goalRealism', () => {
  it('20 kg in 12 Wochen = zu schnell (>1 kg/Woche)', () => {
    const r = goalRealism(110, 90, { weeks: 12 })!;
    expect(r.kgToLose).toBe(20);
    expect(r.perWeek).toBeCloseTo(1.67, 2);
    expect(r.tooFast).toBe(true);
    expect(r.minWeeks).toBe(20); // bei ~1 kg/Woche
    expect(r.maxWeeks).toBe(40); // bei ~0,5 kg/Woche
    expect(r.ambitious).toBe(true); // 20/110 > 15 %
  });

  it('20 kg in 24 Wochen = gesundes Tempo', () => {
    const r = goalRealism(110, 90, { weeks: 24 })!;
    expect(r.tooFast).toBe(false);
    expect(r.perWeek).toBeCloseTo(0.83, 2);
  });

  it('ohne Zeitrahmen: perWeek null, kein tooFast', () => {
    const r = goalRealism(90, 80)!;
    expect(r.perWeek).toBeNull();
    expect(r.tooFast).toBe(false);
    expect(r.minWeeks).toBe(10);
    expect(r.maxWeeks).toBe(20);
  });

  it('kein nennenswertes Abnehmziel -> null', () => {
    expect(goalRealism(80, 79.7)).toBeNull(); // 0,3 kg
    expect(goalRealism(80, 85)).toBeNull();   // Zunahme
  });

  it('Zielgewicht unter gesundem BMI wird erkannt', () => {
    const low = goalRealism(70, 45, { heightCm: 180 })!; // BMI ~13,9
    expect(low.belowHealthyBmi).toBe(true);
    const ok = goalRealism(90, 75, { heightCm: 180 })!;  // BMI ~23,1
    expect(ok.belowHealthyBmi).toBe(false);
  });
});
