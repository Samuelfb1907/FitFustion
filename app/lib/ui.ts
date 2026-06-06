// Gemeinsames Design-System (Clean Light): flach, viel Weissraum, feine Linien, EIN Akzent.
// Tiefe entsteht NICHT durch starke Schatten, sondern durch feine Raender + Flaechenkontrast.
import { StyleSheet } from 'react-native';

// Sehr dezenter, fast flacher Karten-Schatten (bewusst zurueckhaltend).
export const CARD_SHADOW = {
  shadowColor: '#0E1217',
  shadowOpacity: 0.04,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
};

// Einheitliche Eckenradien.
export const RADIUS = {
  card: 16,
  button: 12,
  input: 12,
  pill: 999,
  sm: 10,
};

// Einheitliche Abstands-Skala (8pt-orientiert).
export const SPACE = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
};

export const HAIRLINE = StyleSheet.hairlineWidth;
