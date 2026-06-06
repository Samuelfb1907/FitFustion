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
          <RadialGradient id="ambientGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={c.primary} stopOpacity={0.1} />
            <Stop offset="100%" stopColor={c.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={W * 0.85} cy={H * 0.04} r={W * 0.72} fill="url(#ambientGlow)" />
        <Circle cx={W * 0.04} cy={H * 0.44} r={W * 0.62} fill="url(#ambientGlow)" />
        <Circle cx={W * 0.96} cy={H * 0.97} r={W * 0.72} fill="url(#ambientGlow)" />
      </Svg>
    </View>
  );
}
