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

// "Clean Light" Design-System: viel Weissraum, neutrale Graustufen + EIN edler
// Smaragd-Akzent, hoher Lese-Kontrast, flache Flaechen mit feinen Raendern.
// Funktioniert in Hell UND Dunkel (Dark Mode bleibt erhalten).
const LIGHT: Colors = {
  bg: '#F5F6F8', card: '#FFFFFF', text: '#1B1F24', textMuted: '#6B727C', heading: '#0E1217',
  primary: '#0E9F6E', onPrimary: '#FFFFFF', border: '#E8EAED', inputBg: '#F2F4F6',
  danger: '#E5484D', success: '#0E9F6E', track: '#ECEEF1',
  accent: '#0E9F6E', hero: '#0E1217', muscle: '#E2E6EA',
};
const DARK: Colors = {
  bg: '#0F1216', card: '#181C21', text: '#E8EBEF', textMuted: '#969EA8', heading: '#F3F5F7',
  primary: '#16B486', onPrimary: '#04231A', border: '#252A30', inputBg: '#1D2228',
  danger: '#FF6B6B', success: '#1FB587', track: '#252A30',
  accent: '#1FB587', hero: '#11221C', muscle: '#2A2F36',
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
