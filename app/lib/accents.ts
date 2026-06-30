// Freischaltbare Akzentfarben (Belohnung). Jede Farbe ueberschreibt nur einen kleinen
// Satz Theme-Farben (primary/onPrimary/accent/cardBorder) in Hell UND Dunkel - der Rest
// des Designs (Neutralgrau, danger/success-Semantik) bleibt gleich. Freigeschaltet wird
// nach Anzahl verdienter Abzeichen (siehe lib/badges.ts ACHIEVEMENTS).

export type AccentOverride = { primary: string; onPrimary: string; accent: string; cardBorder: string };
export type Accent = { key: string; unlockAt: number; light: AccentOverride; dark: AccentOverride };

// unlockAt = Anzahl Abzeichen, ab der die Farbe waehlbar ist (0 = von Anfang an).
export const ACCENTS: Accent[] = [
  { key: 'emerald', unlockAt: 0,
    light: { primary: '#097A50', onPrimary: '#FFFFFF', accent: '#0E9F6E', cardBorder: 'rgba(14,159,110,0.30)' },
    dark:  { primary: '#19C98F', onPrimary: '#062E20', accent: '#2BD79B', cardBorder: 'rgba(255,255,255,0.07)' } },
  { key: 'ocean', unlockAt: 1,
    light: { primary: '#0B6BCB', onPrimary: '#FFFFFF', accent: '#2D8FE6', cardBorder: 'rgba(13,110,253,0.28)' },
    dark:  { primary: '#3B9EFF', onPrimary: '#04243F', accent: '#5BB0FF', cardBorder: 'rgba(255,255,255,0.07)' } },
  { key: 'violet', unlockAt: 2,
    light: { primary: '#6D28D9', onPrimary: '#FFFFFF', accent: '#8B5CF6', cardBorder: 'rgba(124,58,237,0.28)' },
    dark:  { primary: '#A78BFA', onPrimary: '#2A1259', accent: '#C4B5FD', cardBorder: 'rgba(255,255,255,0.07)' } },
  { key: 'sunset', unlockAt: 3,
    light: { primary: '#C2410C', onPrimary: '#FFFFFF', accent: '#F97316', cardBorder: 'rgba(234,88,12,0.28)' },
    dark:  { primary: '#FB923C', onPrimary: '#3A1A05', accent: '#FDBA74', cardBorder: 'rgba(255,255,255,0.07)' } },
  { key: 'crimson', unlockAt: 5,
    light: { primary: '#BE123C', onPrimary: '#FFFFFF', accent: '#F43F5E', cardBorder: 'rgba(225,29,72,0.28)' },
    dark:  { primary: '#FB7185', onPrimary: '#4C0519', accent: '#FDA4AF', cardBorder: 'rgba(255,255,255,0.07)' } },
  { key: 'gold', unlockAt: 8,
    light: { primary: '#B45309', onPrimary: '#FFFFFF', accent: '#F59E0B', cardBorder: 'rgba(217,119,6,0.30)' },
    dark:  { primary: '#FBBF24', onPrimary: '#3A2A05', accent: '#FCD34D', cardBorder: 'rgba(255,255,255,0.07)' } },
];

export const DEFAULT_ACCENT = 'emerald';

export function accentByKey(key: string | null | undefined): Accent {
  return ACCENTS.find((a) => a.key === key) ?? ACCENTS[0];
}

// Swatch-Farbe fuer die Auswahl-UI (nimmt die Hell-Variante als Vorschau).
export function accentSwatch(a: Accent): string {
  return a.light.accent;
}
