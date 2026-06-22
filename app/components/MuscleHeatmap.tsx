// Muskel-Heatmap / Erholung (#67): anatomische Figur (vorne + hinten), Muskeln eingefaerbt
// nach "zuletzt trainiert": gerade trainiert = rot (erholt sich), laenger her = gruen (bereit).
// Nutzt react-native-body-highlighter (wie ExerciseFigure) - kein eigenes SVG, kein Foto.
import Body, { ExtendedBodyPart, Slug } from 'react-native-body-highlighter';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../contexts/LanguageContext';
import { Colors } from '../contexts/ThemeContext';

// App-Muskel-Key -> Slugs der Koerpergrafik (gleiche Zuordnung wie ExerciseFigure).
const KEY_TO_SLUGS: Record<string, Slug[]> = {
  chest: ['chest'], biceps: ['biceps'], triceps: ['triceps'], shoulders: ['deltoids'],
  abs: ['abs', 'obliques'], back: ['trapezius', 'upper-back', 'lower-back'],
  legs: ['quadriceps', 'hamstring', 'adductors'], calves: ['calves'], glutes: ['gluteal'],
};
const SORE = '#FF6B6B';  // <=1 Tag: gerade trainiert, erholt sich
const SOON = '#F0B429';  // 2-3 Tage
const FRESH = '#19C98F'; // 4+ Tage: frisch/bereit
function fillFor(days: number): string { return days <= 1 ? SORE : days <= 3 ? SOON : FRESH; }

export default function MuscleHeatmap({ recovery, c }: { recovery: Record<string, number>; c: Colors }) {
  const { profile } = useAuth();
  const t = useT();
  const gender = profile?.gender === 'female' ? 'female' : 'male';

  const data: ExtendedBodyPart[] = [];
  for (const [key, days] of Object.entries(recovery)) {
    const slugs = KEY_TO_SLUGS[key];
    if (!slugs) continue;
    for (const slug of slugs) data.push({ slug, styles: { fill: fillFor(days), stroke: c.border, strokeWidth: 2 } });
  }

  return (
    <View>
      <View style={styles.bodies}>
        <Body side="front" gender={gender} scale={0.6} data={data} defaultFill={c.muscle} defaultStroke={c.border} defaultStrokeWidth={2} border={c.textMuted} />
        <Body side="back" gender={gender} scale={0.6} data={data} defaultFill={c.muscle} defaultStroke={c.border} defaultStrokeWidth={2} border={c.textMuted} />
      </View>
      <View style={styles.legend}>
        <Item color={SORE} label={t('progress.heatmap.sore')} c={c} />
        <Item color={SOON} label={t('progress.heatmap.soon')} c={c} />
        <Item color={FRESH} label={t('progress.heatmap.fresh')} c={c} />
      </View>
    </View>
  );
}

function Item({ color, label, c }: { color: string; label: string; c: Colors }) {
  return (
    <View style={styles.item}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bodies: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 10, flexWrap: 'wrap' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  label: { fontSize: 12, fontWeight: '600' },
});
