// Kleiner Hinweis-Kasten beim Setzen eines Abnehmziels: ordnet das Ziel ehrlich ein
// (realistische Dauer) und warnt freundlich bei zu schnellem Tempo oder zu niedrigem
// Zielgewicht. Nutzt den reinen Helfer goalRealism(). Wird in ProfileScreen &
// OnboardingScreen verwendet.
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../contexts/ThemeContext';
import type { GoalRealism } from '../lib/goalRealism';

type TFn = (key: string, params?: Record<string, string | number>) => string;

export default function GoalRealismCard({ realism, c, t }: { realism: GoalRealism; c: Colors; t: TFn }) {
  // Verdikt priorisiert: gesundheitlich kritisch > Tempo (nur mit Zeitrahmen) > Menge.
  let verdictKey: string;
  if (realism.belowHealthyBmi) verdictKey = 'goalRealism.lowBmi';
  else if (realism.perWeek != null) verdictKey = realism.tooFast ? 'goalRealism.tooFast' : 'goalRealism.good';
  else verdictKey = realism.ambitious ? 'goalRealism.ambitious' : 'goalRealism.steady';

  // Farbton: rot bei BMI-Warnung, Bernstein bei zu schnell, sonst dezent grün.
  const tone = realism.belowHealthyBmi ? 'warn' : realism.tooFast ? 'attn' : 'ok';
  const palette = {
    ok: { bg: 'rgba(25,201,143,0.10)', border: 'rgba(25,201,143,0.35)' },
    attn: { bg: 'rgba(230,150,20,0.12)', border: 'rgba(230,150,20,0.45)' },
    warn: { bg: 'rgba(230,83,61,0.12)', border: 'rgba(230,83,61,0.45)' },
  }[tone];

  const params = { kg: realism.kgToLose, min: realism.minWeeks, max: realism.maxWeeks };

  return (
    <View style={[styles.card, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.title, { color: c.heading }]}>{t('goalRealism.title')}</Text>
      <Text style={[styles.body, { color: c.text }]}>{t('goalRealism.duration', params)}</Text>
      <Text style={[styles.body, styles.verdict, { color: c.text }]}>{t(verdictKey, params)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 12 },
  title: { fontSize: 14, fontWeight: '800', marginBottom: 6 },
  body: { fontSize: 13, lineHeight: 19 },
  verdict: { marginTop: 6, fontWeight: '600' },
});
