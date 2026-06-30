// Rueckblick-Karte (#76d): "Vor X Monaten: 60 kg -> heute 75 kg". Macht Fortschritt
// sichtbar. Bekommt die Items vom Host (ProgressScreen). Zeigt nichts, wenn leer.
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import { ThrowbackItem } from '../lib/throwback';

function agoLabel(days: number, t: (k: string, p?: any) => string): string {
  if (days >= 60) return t('throwback.monthsAgo', { n: Math.round(days / 30) });
  return t('throwback.weeksAgo', { n: Math.max(1, Math.round(days / 7)) });
}

export default function ThrowbackCard({ items }: { items: ThrowbackItem[] }) {
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={{ gap: 16 }}>
      {items.map((it, i) => {
        const title = it.type === 'weight' ? t('throwback.weightTitle') : it.name;
        const delta = Math.round((it.now - it.then) * 10) / 10;
        const positive = delta > 0;
        // Bei Lifts ist mehr Gewicht = besser (gruen). Bei Koerpergewicht neutral lassen.
        const deltaColor = it.type === 'lift' ? c.success : c.textMuted;
        const sign = positive ? '+' : '';
        return (
          <View key={i} style={styles.row}>
            <Text style={styles.ago}>{agoLabel(it.days, t)}</Text>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <View style={styles.values}>
              <Text style={styles.then}>{it.then} kg</Text>
              <Text style={styles.arrow}>→</Text>
              <Text style={styles.now}>{it.now} kg</Text>
              <Text style={[styles.delta, { color: deltaColor }]}>{sign}{delta} kg</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    row: {},
    ago: { fontSize: 12, fontWeight: '700', color: c.textMuted, marginBottom: 2 },
    title: { fontSize: 15, fontWeight: '800', color: c.heading, marginBottom: 6 },
    values: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    then: { fontSize: 16, fontWeight: '700', color: c.textMuted },
    arrow: { fontSize: 15, color: c.textMuted },
    now: { fontSize: 19, fontWeight: '900', color: c.heading },
    delta: { fontSize: 13, fontWeight: '800', marginLeft: 2 },
  });
}
