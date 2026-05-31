// Halbkreis-Diagramm (Gauge) mit Animation, theme-fähig.
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useColors } from '../contexts/ThemeContext';

function arcPath(cx: number, cy: number, r: number, fStart: number, fEnd: number, segments: number): string {
  let d = '';
  for (let i = 0; i <= segments; i++) {
    const f = fStart + (fEnd - fStart) * (i / segments);
    const theta = Math.PI * (1 - f);
    const x = cx + r * Math.cos(theta);
    const y = cy - r * Math.sin(theta);
    d += (i === 0 ? 'M' : ' L') + ` ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}

export default function CalorieGauge({ target, eaten }: { target: number; eaten: number }) {
  const c = useColors();
  const W = 240;
  const stroke = 20;
  const r = 100;
  const cx = W / 2;
  const cy = r + stroke / 2;
  const height = cy + stroke / 2 + 2;

  const fraction = target > 0 ? Math.min(eaten / target, 1) : 0;
  const finalOver = target - eaten < 0;
  const fgColor = finalOver ? c.danger : c.success;
  const bgPath = arcPath(cx, cy, r, 0, 1, 60);

  const anim = useRef(new Animated.Value(0)).current;
  const [p, setP] = useState(0);
  useEffect(() => {
    setP(0);
    anim.setValue(0);
    const id = anim.addListener(({ value }) => setP(value));
    Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: false }).start();
    return () => {
      anim.removeListener(id);
      anim.stopAnimation();
    };
  }, [target, eaten]);

  const fillFraction = fraction * p;
  const shownRemaining = Math.round(target - eaten * p);
  const curOver = shownRemaining < 0;
  const fgPath = arcPath(cx, cy, r, 0, fillFraction, Math.max(2, Math.round(60 * fillFraction)));

  return (
    <View style={styles.wrap}>
      <View style={{ width: W, height }}>
        <Svg width={W} height={height}>
          <Path d={bgPath} stroke={c.track} strokeWidth={stroke} strokeLinecap="round" fill="none" />
          {fillFraction > 0.005 && (
            <Path d={fgPath} stroke={fgColor} strokeWidth={stroke} strokeLinecap="round" fill="none" />
          )}
        </Svg>
        <View style={[styles.center, { width: W, top: cy - 64 }]}>
          <Text style={[styles.big, { color: curOver ? c.danger : c.heading }]}>
            {Math.abs(shownRemaining).toLocaleString('de-DE')}
          </Text>
          <Text style={[styles.label, { color: c.textMuted }]}>{curOver ? 'kcal über Ziel' : 'kcal übrig'}</Text>
        </View>
      </View>

      <View style={styles.footRow}>
        <View style={styles.foot}>
          <Text style={[styles.footValue, { color: c.text }]}>{Math.round(eaten).toLocaleString('de-DE')}</Text>
          <Text style={[styles.footLabel, { color: c.textMuted }]}>gegessen</Text>
        </View>
        <View style={styles.foot}>
          <Text style={[styles.footValue, { color: c.text }]}>{target.toLocaleString('de-DE')}</Text>
          <Text style={[styles.footLabel, { color: c.textMuted }]}>Ziel (kcal)</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  center: { position: 'absolute', left: 0, alignItems: 'center' },
  big: { fontSize: 38, fontWeight: 'bold' },
  label: { fontSize: 14, marginTop: -2 },
  footRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 6, gap: 36 },
  foot: { alignItems: 'center' },
  footValue: { fontSize: 16, fontWeight: '700' },
  footLabel: { fontSize: 12, marginTop: 1 },
});
