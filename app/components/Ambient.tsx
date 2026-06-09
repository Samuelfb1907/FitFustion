// Farbiger, weicher "Aurora"-Hintergrund: mehrere radiale Glows (Smaragd + Teal +
// Violett), die zum Rand transparent auslaufen. Liegt als nicht-antippbarer Layer
// hinter dem Inhalt - er gibt dem Liquid Glass etwas zum "Durchscheinen".
import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Colors, useTheme } from '../contexts/ThemeContext';

export default function Ambient({ c }: { c: Colors }) {
  const { width: W, height: H } = Dimensions.get('window');
  const { theme } = useTheme();
  const dark = theme === 'dark';

  // Palette: Marke (Smaragd) + kuehles Teal + dezentes Violett. In den Ecken platziert,
  // damit die Bildmitte (wo Text sitzt) ruhiger bleibt.
  const blobs = dark
    ? [
        { col: c.primary, op: 0.30, cx: 0.85, cy: 0.0, r: 0.95 },
        { col: '#22D3EE', op: 0.18, cx: 0.0, cy: 0.32, r: 0.8 },
        { col: '#7C5CFF', op: 0.16, cx: 0.98, cy: 0.7, r: 0.75 },
        { col: c.primary, op: 0.22, cx: 0.4, cy: 1.02, r: 0.95 },
      ]
    : [
        { col: c.primary, op: 0.20, cx: 0.85, cy: 0.0, r: 0.95 },
        { col: '#38BDF8', op: 0.16, cx: 0.0, cy: 0.32, r: 0.8 },
        { col: '#A78BFA', op: 0.14, cx: 0.98, cy: 0.7, r: 0.75 },
        { col: c.primary, op: 0.16, cx: 0.4, cy: 1.02, r: 0.95 },
      ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={W} height={H}>
        <Defs>
          {blobs.map((b, i) => (
            <RadialGradient key={i} id={`amb${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={b.col} stopOpacity={b.op} />
              <Stop offset="100%" stopColor={b.col} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {blobs.map((b, i) => (
          <Circle key={i} cx={W * b.cx} cy={H * b.cy} r={W * b.r} fill={`url(#amb${i})`} />
        ))}
      </Svg>
    </View>
  );
}
