// Dezenter, weicher Smaragd-Hintergrund: drei radiale "Glows" mit sehr niedriger
// Deckkraft, die zum Rand transparent auslaufen. Liegt als nicht-antippbarer Layer
// hinter dem Inhalt und passt sich automatisch an Hell/Dunkel an (nutzt c.primary).
import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Colors } from '../contexts/ThemeContext';

export default function Ambient({ c }: { c: Colors }) {
  const { width: W, height: H } = Dimensions.get('window');
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={W} height={H}>
        <Defs>
          <RadialGradient id="aPrimary" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={c.primary} stopOpacity={0.16} />
            <Stop offset="100%" stopColor={c.primary} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="aAccent" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={c.accent} stopOpacity={0.12} />
            <Stop offset="100%" stopColor={c.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={W * 0.82} cy={H * 0.02} r={W * 0.85} fill="url(#aPrimary)" />
        <Circle cx={W * 0.0} cy={H * 0.40} r={W * 0.72} fill="url(#aAccent)" />
        <Circle cx={W * 1.0} cy={H * 0.64} r={W * 0.6} fill="url(#aAccent)" />
        <Circle cx={W * 0.5} cy={H * 1.02} r={W * 0.9} fill="url(#aPrimary)" />
      </Svg>
    </View>
  );
}
