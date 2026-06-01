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

const LIGHT: Colors = {
  bg: '#F1F4FA', card: '#FFFFFF', text: '#1A2230', textMuted: '#7C8AA0', heading: '#16224A',
  primary: '#2B50D8', onPrimary: '#FFFFFF', border: '#E4EAF3', inputBg: '#F6F8FC',
  danger: '#D92D20', success: '#1F9D55', track: '#E4EAF3',
  accent: '#12B886', hero: '#22357F', muscle: '#C3D0E8',
};
const DARK: Colors = {
  bg: '#0E1117', card: '#181F2A', text: '#E6EAF0', textMuted: '#94A1B4', heading: '#EAF1FF',
  primary: '#5B86F0', onPrimary: '#FFFFFF', border: '#283242', inputBg: '#1E2735',
  danger: '#FF6B6B', success: '#5BD18A', track: '#283242',
  accent: '#38D9A9', hero: '#1A2A66', muscle: '#33445E',
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

const STORAGE_KEY = 'fitfusion.theme';

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
