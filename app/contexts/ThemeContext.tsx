// Theme-System: Hell-/Dunkel-Modus mit zentralem Farb-Satz, gespeichert auf dem Gerät.
// Screens holen sich Farben per useColors() und passen sich so automatisch an.
import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  inputBg: string;
  danger: string;
  success: string;
  track: string;     // Fortschritts-/Gauge-Hintergrund
  accent: string;    // lebendige Akzentfarbe (Highlights)
  hero: string;      // dunkle Hero-Flaeche fuer Karten
  muscle: string;    // Grundfarbe der Muskeln im Koerper-Diagramm
};

// Modernes Indigo/Violett-Farbsystem (frisch & einladend).
const LIGHT: Colors = {
  bg: '#F4F5FB', card: '#FFFFFF', text: '#1E2433', textMuted: '#79839B', heading: '#1E1B4B',
  primary: '#6366F1', onPrimary: '#FFFFFF', border: '#E6E8F2', inputBg: '#F1F2FA',
  danger: '#EF4444', success: '#10B981', track: '#E6E8F2',
  accent: '#8B5CF6', hero: '#312E81', muscle: '#CBD2EC',
};
const DARK: Colors = {
  bg: '#0E1116', card: '#181B26', text: '#E7E9F0', textMuted: '#8B93A7', heading: '#EEF0FF',
  primary: '#7C83F7', onPrimary: '#FFFFFF', border: '#272C3A', inputBg: '#1E2230',
  danger: '#FF6B6B', success: '#34D399', track: '#272C3A',
  accent: '#A78BFA', hero: '#26235C', muscle: '#33445E',
};

type ThemeCtx = {
  theme: ThemeName;
  colors: Colors;
  toggleTheme: () => void;
  setTheme: (t: ThemeName) => void;
};

const ThemeContext = createContext<ThemeCtx>({
  theme: 'light',
  colors: LIGHT,
  toggleTheme: () => {},
  setTheme: () => {},
});

const STORAGE_KEY = 'fitavo.theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('light');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'dark' || v === 'light') setThemeState(v);
    });
  }, []);

  const setTheme = useCallback((t: ThemeName) => {
    setThemeState(t);
    AsyncStorage.setItem(STORAGE_KEY, t).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const colors = theme === 'dark' ? DARK : LIGHT;
  const value = useMemo(() => ({ theme, colors, toggleTheme, setTheme }), [theme, colors, toggleTheme, setTheme]);

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
