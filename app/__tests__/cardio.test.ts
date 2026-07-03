import { describe, it, expect } from '@jest/globals';
import { cardioKcal, cardioTypeByKey, CARDIO_TYPES } from '../lib/cardio';

describe('cardio', () => {
  it('cardioKcal = MET * kg * Stunden (30 Min Laufband @ 80 kg)', () => {
    // MET 8.5 * 80 kg * 0.5 h = 340
    expect(cardioKcal(8.5, 80, 30)).toBe(340);
  });

  it('schwerere Person verbrennt mehr (gleiche Aktivitaet & Dauer)', () => {
    const leicht = cardioKcal(7.5, 60, 45);
    const schwer = cardioKcal(7.5, 90, 45);
    expect(schwer).toBeGreaterThan(leicht);
  });

  it('ungueltige/leere Eingaben -> 0', () => {
    expect(cardioKcal(8.5, 0, 30)).toBe(0);
    expect(cardioKcal(0, 80, 30)).toBe(0);
    expect(cardioKcal(8.5, 80, 0)).toBe(0);
    expect(cardioKcal(8.5, 80, -10)).toBe(0);
  });

  it('deckelt die Dauer bei 600 Minuten (Fehleingabe-Schutz)', () => {
    expect(cardioKcal(8.5, 80, 10000)).toBe(cardioKcal(8.5, 80, 600));
  });

  it('jeder Cardio-Typ hat MET, Icon und ist per Key auffindbar', () => {
    for (const ct of CARDIO_TYPES) {
      expect(ct.met).toBeGreaterThan(0);
      expect(ct.icon.length).toBeGreaterThan(0);
      expect(cardioTypeByKey(ct.key)).toEqual(ct);
    }
  });
});
