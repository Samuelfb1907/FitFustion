// Voll-Kreis-Kalorienring mit Farbverlauf (Smaragd -> Mint), leuchtendem
// Endpunkt und Fuell-Animation. Darunter: gegessen | Tagesziel mit Trennlinie.
// Theme- und sprachfaehig (DE/EN).
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useColors, useTheme } from '../contexts/ThemeContext';
import { useT, useLang } from '../contexts/LanguageContext';

const SIZE = 216;
const STROKE = 16;
const R = (SIZE - STROKE) / 2 - 2;
const CX = SIZE / 2;
const CY = SIZE / 2;
const SEGMENTS = 32; // Verlaufs-Aufloesung: Ring wird aus Boegen mit interpolierter Farbe gezeichnet

function hexToRgb(h: string): [number, number, number] {
  const x = h.replace('#', '');
  return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)];
}
function mix(a: string, b: string, f: number): string {
  const ra = hexToRgb(a), rb = hexToRgb(b);
  return `rgb(${Math.round(ra[0] + (rb[0] - ra[0]) * f)},${Math.round(ra[1] + (rb[1] - ra[1]) * f)},${Math.round(ra[2] + (rb[2] - ra[2]) * f)})`;
}
// Farbe entlang des gezeichneten Bogens (3 Stuetzstellen, f = 0..1)
function rampColor(f: number, ramp: [string, string, string]): string {
  return f < 0.55 ? mix(ramp[0], ramp[1], f / 0.55) : mix(ramp[1], ramp[2], (f - 0.55) / 0.45);
}
// Punkt auf dem Ring: frac 0..1, Start oben (12 Uhr), im Uhrzeigersinn
function polar(frac: number): { x: number; y: number } {
  const a = (frac * 360 - 90) * (Math.PI / 180);
  return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
}

export default function CalorieGauge({ target, eaten, base }: { target: number; eaten: number; base?: number }) {
  const c = useColors();
  const { theme } = useTheme();
  const t = useT();
  const { lang } = useLang();
  const loc = lang === 'en' ? 'en-US' : 'de-DE';
  const dark = theme === 'dark';
  const ramp: [string, string, string] = dark ? ['#0E7A50', '#19C98F', '#46E3AC'] : ['#0B6B46', '#0E9F6E', '#19C98F'];
  const dotColor = dark ? '#8FF3CF' : '#0E9F6E';

  const fraction = target > 0 ? Math.min(eaten / target, 1) : 0;
  const finalOver = target - eaten < 0;

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

  const fill = fraction * p;
  const shownRemaining = Math.round(target - eaten * p);
  const curOver = shownRemaining < 0;

  // Bogen-Segmente mit interpolierter Farbe (ein durchgehender Verlauf)
  const segs: { d: string; col: string }[] = [];
  if (fill > 0.004) {
    const n = Math.max(1, Math.ceil(SEGMENTS * fill));
    for (let i = 0; i < n; i++) {
      const a = polar(fill * (i / n));
      const b = polar(fill * ((i + 1) / n));
      segs.push({
        d: `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
        col: finalOver ? c.danger : rampColor((i + 1) / n, ramp),
      });
    }
  }
  const dot = polar(fill);

  const a11yLabel = t('home.gauge.a11y', {
    eaten: Math.round(eaten).toLocaleString(loc),
    target: target.toLocaleString(loc),
    diff: Math.abs(Math.round(target - eaten)).toLocaleString(loc),
    state: t(target - eaten < 0 ? 'home.gauge.over' : 'home.gauge.remaining'),
  });

  return (
    <View style={styles.wrap} accessible accessibilityLabel={a11yLabel}>
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={CX} cy={CY} r={R} stroke={c.track} strokeWidth={STROKE} fill="none" />
          {segs.map((s, i) => (
            <Path key={i} d={s.d} stroke={s.col} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
          ))}
          {fill > 0.03 && !finalOver && <Circle cx={dot.x} cy={dot.y} r={6} fill={dotColor} />}
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <Text style={[styles.big, { color: curOver ? c.danger : c.heading }]}>
            {Math.abs(shownRemaining).toLocaleString(loc)}
          </Text>
          <Text style={[styles.label, { color: c.textMuted }]}>{t(curOver ? 'home.gauge.over' : 'home.gauge.remaining')}</Text>
        </View>
      </View>

      <View style={styles.footRow}>
        <View style={styles.foot}>
          <Text style={[styles.footValue, { color: c.heading }]} numberOfLines={1}>{Math.round(eaten).toLocaleString(loc)}</Text>
          <Text style={[styles.footLabel, { color: c.textMuted }]} numberOfLines={1}>{t('home.gauge.eaten')}</Text>
        </View>
        <View style={[styles.footSep, { backgroundColor: c.border }]} />
        <View style={styles.foot}>
          <Text style={[styles.footValue, { color: c.heading }]} numberOfLines={1}>{target.toLocaleString(loc)}</Text>
          <Text style={[styles.footLabel, { color: c.textMuted }]} numberOfLines={1}>{t('home.gauge.target')}</Text>
        </View>
      </View>

      {/* Grundbedarf (ohne Training/Schritte) einblenden, sobald durch Aktivitaet dazugekommen ist. */}
      {base != null && base > 0 && base < target && (
        <Text style={[styles.baseCaption, { color: c.textMuted }]} numberOfLines={1}>
          {t('home.gauge.base', { base: base.toLocaleString(loc), bonus: (target - base).toLocaleString(loc) })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', alignSelf: 'stretch' },
  center: { position: 'absolute', left: 0, top: 0, width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  // Android: weniger fett -> die hellen Ziffern "bluehen" sonst auf dem dunklen Grund (wirkt wie Glow).
  big: { fontSize: 42, fontWeight: Platform.OS === 'android' ? '700' : '900', letterSpacing: -1, lineHeight: 46 },
  label: { fontSize: 13, fontWeight: '500', marginTop: 8 },
  footRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginTop: 18 },
  foot: { flex: 1, alignItems: 'center' },
  footValue: { fontSize: 21, fontWeight: Platform.OS === 'android' ? '700' : '800', letterSpacing: -0.3 },
  footLabel: { fontSize: 12, fontWeight: '500', marginTop: 8 },
  footSep: { width: 1, height: 40 },
  baseCaption: { fontSize: 12, fontWeight: '500', marginTop: 14, textAlign: 'center' },
});
