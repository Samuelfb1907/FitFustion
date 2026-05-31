// Theme-System: Hell-/Dunkel-Modus mit zentralem Farb-Satz, gespeichert auf dem Gerät.
// Screens holen sich Farben per useColors() und passen sich so automatisch an.
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
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
};

const LIGHT: Colors = {
  bg: '#F2F5FA', card: '#FFFFFF', text: '#222222', textMuted: '#8A97A8', heading: '#1F3864',
  primary: '#1F3864', onPrimary: '#FFFFFF', border: '#E3E9F2', inputBg: '#FFFFFF',
  danger: '#B00020', success: '#1a7f37', track: '#E3E9F2',
};
const DARK: Colors = {
  bg: '#0F141B', card: '#1A222E', text: '#E6EAF0', textMuted: '#9AA5B4', heading: '#EAF1FF',
  primary: '#3B6FD4', onPrimary: '#FFFFFF', border: '#2A3442', inputBg: '#222C3A',
  danger: '#FF6B6B', success: '#5BD18A', track: '#2A3442',
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

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, setTheme }}>
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
