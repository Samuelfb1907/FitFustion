// Liquid-Glass-Flaeche: echter Blur (expo-blur) + dezente Toenung + feine Lichtkante.
// Liegt ueber dem Inhalt dahinter und passt sich Hell/Dunkel automatisch an.
// Verwendung wie eine View: <Glass style={...}>{kinder}</Glass>
import { ReactNode } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useColors, useTheme } from '../contexts/ThemeContext';

export default function Glass({
  children,
  style,
  radius = 18,
  intensity,
  border = true,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  intensity?: number;
  border?: boolean;
}) {
  const c = useColors();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return (
    <View
      style={[
        { borderRadius: radius, overflow: 'hidden' },
        border ? { borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline } : null,
        style,
      ]}
    >
      {Platform.OS === 'android' ? (
        // Android: expo-blur (dimezisBlurView) rendert milchig-grau -> stattdessen deckende
        // Kartenflaeche, damit Schrift (z. B. Umschalter-Labels) lesbar bleibt. iOS = echtes Glas.
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.card }]} pointerEvents="none" />
      ) : (
        <>
          <BlurView intensity={intensity ?? (dark ? 46 : 66)} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: c.glass }]} pointerEvents="none" />
        </>
      )}
      {children}
    </View>
  );
}
