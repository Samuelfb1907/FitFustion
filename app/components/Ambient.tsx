// Schoener Aurora-/Mesh-Hintergrund: ein weicher vertikaler Grundverlauf fuer Tiefe
// plus mehrere ueberlappende, leicht gedrehte Farb-Glows (Smaragd, Teal, Blau,
// Violett). Liegt als nicht-antippbarer Layer hinter dem Inhalt und gibt dem
// Liquid Glass viel "Farbe zum Durchscheinen". Passt sich Hell/Dunkel an.
import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Colors, useTheme } from '../contexts/ThemeContext';

export default function Ambient({ c }: { c: Colors }) {
  const { width: W, height: H } = Dimensions.get('window');
  const { theme } = useTheme();
  const dark = theme === 'dark';

  // Organische Glows als gedrehte Ellipsen. cx/cy/rx/ry als Anteil von W bzw. H.
  const blobs = dark
    ? [
        { col: c.primary, op: 0.36, cx: 0.9, cy: 0.04, rx: 0.95, ry: 0.42, rot: -18 },
        { col: '#22D3EE', op: 0.24, cx: 0.04, cy: 0.24, rx: 0.85, ry: 0.36, rot: 14 },
        { col: '#3B82F6', op: 0.18, cx: 0.52, cy: 0.52, rx: 1.0, ry: 0.4, rot: -10 },
        { col: '#8B5CF6', op: 0.24, cx: 1.02, cy: 0.8, rx: 0.85, ry: 0.36, rot: 18 },
        { col: c.primary, op: 0.26, cx: 0.16, cy: 1.0, rx: 0.95, ry: 0.42, rot: -14 },
      ]
    : [
        { col: c.primary, op: 0.22, cx: 0.9, cy: 0.04, rx: 0.95, ry: 0.42, rot: -18 },
        { col: '#38BDF8', op: 0.18, cx: 0.04, cy: 0.24, rx: 0.85, ry: 0.36, rot: 14 },
        { col: '#60A5FA', op: 0.13, cx: 0.52, cy: 0.52, rx: 1.0, ry: 0.4, rot: -10 },
        { col: '#A78BFA', op: 0.17, cx: 1.02, cy: 0.8, rx: 0.85, ry: 0.36, rot: 18 },
        { col: c.primary, op: 0.17, cx: 0.16, cy: 1.0, rx: 0.95, ry: 0.42, rot: -14 },
      ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="ambBase" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={dark ? '#123626' : '#E8F6EF'} stopOpacity={dark ? 0.6 : 0.75} />
            <Stop offset="50%" stopColor={c.bg} stopOpacity={0} />
            <Stop offset="100%" stopColor={dark ? '#0B1A2E' : '#ECEFFB'} stopOpacity={dark ? 0.55 : 0.65} />
          </LinearGradient>
          {blobs.map((b, i) => (
            <RadialGradient key={i} id={`amb${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={b.col} stopOpacity={b.op} />
              <Stop offset="60%" stopColor={b.col} stopOpacity={b.op * 0.35} />
              <Stop offset="100%" stopColor={b.col} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        <Rect x="0" y="0" width={W} height={H} fill="url(#ambBase)" />
        {blobs.map((b, i) => (
          <Ellipse
            key={i}
            cx={W * b.cx}
            cy={H * b.cy}
            rx={W * b.rx}
            ry={H * b.ry}
            rotation={b.rot}
            originX={W * b.cx}
            originY={H * b.cy}
            fill={`url(#amb${i})`}
          />
        ))}
      </Svg>
    </View>
  );
}
