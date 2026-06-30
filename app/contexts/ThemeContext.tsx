// Theme-System: Hell-/Dunkel-Modus mit zentralem Farb-Satz, gespeichert auf dem Gerät.
// Screens holen sich Farben per useColors() und passen sich so automatisch an.
import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACCENTS, DEFAULT_ACCENT, accentByKey } from '../lib/accents';

export type ThemeName = 'light' | 'dark';

export type Colors = {
  bg: string;        // Bildschirm-Hintergrund
  card: string;      // Karten/Flächen
  text: string;      // Haupttext
  textMuted: string; // Sekundärtext
  heading: string;   // Überschriften
  primary: string;   // Markenfarbe / Buttons
  onPrimary: string; // Text auf primary
  border: string;
  cardBorder: string; // dezenter Smaragd-Rahmen um Widget-Karten
  inputBg: string;
  danger: string;
  success: string;
  track: string;     // Fortschritts-/Gauge-Hintergrund
  accent: string;    // lebendige Akzentfarbe (Highlights)
  hero: string;      // dunkle Hero-Flaeche fuer Karten
  muscle: string;    // Grundfarbe der Muskeln im Koerper-Diagramm
  glass: string;       // Toenung ueber dem Blur (Liquid Glass)
  glassStrong: string; // staerkere Toenung (Sheets/Dialoge)
  hairline: string;    // feiner Glas-Rand / Lichtkante
};

// "Clean Light" Design-System: viel Weissraum, neutrale Graustufen + EIN edler
// Smaragd-Akzent, hoher Lese-Kontrast, flache Flaechen mit feinen Raendern.
// Funktioniert in Hell UND Dunkel (Dark Mode bleibt erhalten).
const LIGHT: Colors = {
  bg: '#EEF1F6', card: 'rgba(255,255,255,0.52)', text: '#1B1F24', textMuted: '#555C66', heading: '#0E1217',
  primary: '#097A50', onPrimary: '#FFFFFF', border: 'rgba(20,24,28,0.10)', cardBorder: 'rgba(14,159,110,0.30)', inputBg: 'rgba(20,24,28,0.05)',
  danger: '#C9333A', success: '#097A50', track: 'rgba(20,24,28,0.08)',
  accent: '#0E9F6E', hero: '#0E1217', muscle: '#E2E6EA',
  glass: 'rgba(255,255,255,0.32)', glassStrong: 'rgba(255,255,255,0.6)', hairline: 'rgba(20,24,28,0.10)',
};
// Dark = tiefes, neutrales Anthrazit mit EINEM Smaragd-Akzent (kein Gruenstich
// im Hintergrund). Karten sind nahezu deckend mit feiner heller Kante - das
// wirkt ruhiger und hochwertiger als durchscheinende gruene Flaechen.
const DARK: Colors = {
  bg: '#090D11', card: 'rgba(18,24,30,0.92)', text: '#E9EDF1', textMuted: '#8A94A0', heading: Platform.OS === 'android' ? '#CED6DE' : '#F3F6F8',
  primary: '#19C98F', onPrimary: '#062E20', border: 'rgba(255,255,255,0.10)', cardBorder: 'rgba(255,255,255,0.07)', inputBg: 'rgba(255,255,255,0.06)',
  danger: '#FF6B6B', success: '#2BD79B', track: '#1A232B',
  accent: '#2BD79B', hero: '#10231C', muscle: '#2A2F36',
  glass: 'rgba(10,14,18,0.30)', glassStrong: 'rgba(10,14,18,0.62)', hairline: 'rgba(255,255,255,0.12)',
};

// Nutzer-Praeferenz: dem System folgen (Standard) oder fest hell/dunkel.
export type ThemeMode = 'system' | 'light' | 'dark';

type ThemeCtx = {
  theme: ThemeName;   // tatsaechlich angezeigtes Theme (hell/dunkel)
  mode: ThemeMode;    // Praeferenz: System folgen / fest hell / fest dunkel
  colors: Colors;
  accent: string;     // gewaehlte Akzentfarbe (Schluessel aus lib/accents)
  toggleTheme: () => void;
  setTheme: (t: ThemeName) => void;
  setMode: (m: ThemeMode) => void;
  setAccent: (key: string) => void;
};

const ThemeContext = createContext<ThemeCtx>({
  theme: 'light',
  mode: 'system',
  colors: LIGHT,
  accent: DEFAULT_ACCENT,
  toggleTheme: () => {},
  setTheme: () => {},
  setMode: () => {},
  setAccent: () => {},
});

const MODE_KEY = 'fitavo.themeMode';   // 'system' | 'light' | 'dark'
const LEGACY_KEY = 'fitavo.theme';     // alt: nur 'light' | 'dark'
const ACCENT_KEY = 'fitavo.accent';    // gewaehlte Akzentfarbe

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();                 // 'light' | 'dark' | null (folgt dem Geraet, live)
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [accent, setAccentState] = useState<string>(DEFAULT_ACCENT);

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(MODE_KEY);
        if (v === 'system' || v === 'light' || v === 'dark') { setModeState(v); }
        else {
          // Einmalige Migration vom alten Schalter: bestehende manuelle Wahl beibehalten.
          const legacy = await AsyncStorage.getItem(LEGACY_KEY);
          if (legacy === 'light' || legacy === 'dark') setModeState(legacy);
          // sonst bleibt 'system' (Standard: dem Geraet folgen)
        }
        const a = await AsyncStorage.getItem(ACCENT_KEY);
        if (a && ACCENTS.some((x) => x.key === a)) setAccentState(a);
      } catch {}
    })();
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(MODE_KEY, m).catch(() => {});
  }, []);

  const setAccent = useCallback((key: string) => {
    setAccentState(key);
    AsyncStorage.setItem(ACCENT_KEY, key).catch(() => {});
  }, []);

  // Effektives Theme: bei 'system' dem Geraet folgen, sonst die feste Wahl.
  const theme: ThemeName = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;

  // Rueckwaertskompatibel: setTheme/toggleTheme setzen eine FESTE Wahl (hell/dunkel).
  const setTheme = useCallback((t: ThemeName) => setMode(t), [setMode]);
  const toggleTheme = useCallback(() => setMode(theme === 'dark' ? 'light' : 'dark'), [setMode, theme]);

  // Basis-Theme + Akzent-Override (primary/onPrimary/accent/cardBorder) zusammenfuehren.
  const colors = useMemo<Colors>(() => {
    const base = theme === 'dark' ? DARK : LIGHT;
    const ov = theme === 'dark' ? accentByKey(accent).dark : accentByKey(accent).light;
    return { ...base, ...ov };
  }, [theme, accent]);
  const value = useMemo(() => ({ theme, mode, colors, accent, toggleTheme, setTheme, setMode, setAccent }), [theme, mode, colors, accent, toggleTheme, setTheme, setMode, setAccent]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
export function useColors() {
  return useContext(ThemeContext).colors;
}
