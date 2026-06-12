// Schoener Aurora-/Mesh-Hintergrund: ein weicher Grundverlauf fuer Tiefe plus
// mehrere ueberlappende, leicht gedrehte Farb-Glows. Liegt als nicht-antippbarer
// Layer hinter dem Inhalt und gibt dem Liquid Glass viel "Farbe zum Durchscheinen".
// Hell UND Dunkel sind getrennt abgestimmt - Light ist ein zarter Pastell-Wash
// (Mint/Himmel/Lavendel), nicht nur weiss.
import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Colors, useTheme } from '../contexts/ThemeContext';

export default function Ambient({ c }: { c: Colors }) {
  const { width: W, height: H } = Dimensions.get('window');
  const { theme } = useTheme();
  const dark = theme === 'dark';

  // Durchgehender Grundverlauf (oben -> unten). Light bewusst durchgehend getoent,
  // damit nichts "nur weiss" wirkt; Dark in der Mitte tief.
  const base = dark
    ? [{ col: '#0E2A1F', op: 0.5 }, { col: c.bg, op: 0 }, { col: '#0A1612', op: 0.45 }]
    : [{ col: '#D7F0E6', op: 0.9 }, { col: '#E6EDFB', op: 0.55 }, { col: '#ECE6FB', op: 0.85 }];

  // Organische Glows als gedrehte Ellipsen. cx/cy/rx/ry als Anteil von W bzw. H.
  // Dark bewusst REDUZIERT: nur ein Smaragd-Schimmer oben (wie ein Spotlight)
  // plus ein kaum sichtbarer zweiter unten - kein Farb-Mix mehr (wirkte matschig).
  const blobs = dark
    ? [
        { col: c.primary, op: 0.20, cx: 0.5, cy: -0.06, rx: 1.05, ry: 0.42, rot: 0 },
        { col: '#0E7A50', op: 0.10, cx: 0.1, cy: 1.05, rx: 0.9, ry: 0.4, rot: -12 },
      ]
    : [
        { col: c.primary, op: 0.30, cx: 0.9, cy: 0.04, rx: 0.95, ry: 0.42, rot: -18 },
        { col: '#38BDF8', op: 0.26, cx: 0.04, cy: 0.24, rx: 0.85, ry: 0.36, rot: 14 },
        { col: '#818CF8', op: 0.20, cx: 0.52, cy: 0.52, rx: 1.0, ry: 0.4, rot: -10 },
        { col: '#C4B5FD', op: 0.24, cx: 1.02, cy: 0.8, rx: 0.85, ry: 0.36, rot: 18 },
        { col: '#FDBA74', op: 0.16, cx: 0.96, cy: 0.42, rx: 0.7, ry: 0.3, rot: 8 },
        { col: c.primary, op: 0.22, cx: 0.16, cy: 1.0, rx: 0.95, ry: 0.42, rot: -14 },
      ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="ambBase" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={base[0].col} stopOpacity={base[0].op} />
            <Stop offset="50%" stopColor={base[1].col} stopOpacity={base[1].op} />
            <Stop offset="100%" stopColor={base[2].col} stopOpacity={base[2].op} />
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
