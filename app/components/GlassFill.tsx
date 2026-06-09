// Frost-Hinterlegung (Liquid Glass) zum Einsetzen als ERSTES Kind einer Karte.
// Aendert Layout/Schatten/Rand/Touch der Karte NICHT (absolut + pointerEvents none),
// legt nur echten Blur + Toenung hinter den Inhalt. radius an die Karte anpassen.
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useColors, useTheme } from '../contexts/ThemeContext';

export default function GlassFill({ radius = 16, intensity }: { radius?: number; intensity?: number }) {
  const c = useColors();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]} pointerEvents="none">
      <BlurView intensity={intensity ?? (dark ? 46 : 66)} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.glass }]} />
    </View>
  );
}
