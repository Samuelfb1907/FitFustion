// Trophaeen-Raum (Belohnung): Raster aller Abzeichen. Verdiente in Farbe, gesperrte
// ausgegraut mit Fortschritt (z. B. 7/10). Wird auf dem Fortschritt-Tab gerendert.
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import { BadgeView } from '../lib/badges';

export default function TrophyRoom({ items }: { items: BadgeView[] }) {
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.grid}>
      {items.map((b) => (
        <View key={b.key} style={styles.tile}>
          <View style={[styles.coin, b.earned ? { backgroundColor: c.accent + '22', borderColor: c.accent } : { backgroundColor: c.inputBg, borderColor: c.border }]}>
            <Text style={[styles.emoji, !b.earned && { opacity: 0.35 }]}>{b.emoji}</Text>
          </View>
          <Text style={[styles.name, !b.earned && { color: c.textMuted }]} numberOfLines={2}>{t(`rewards.badge.${b.key}`)}</Text>
          {b.earned
            ? <Text style={styles.earned}>{t('rewards.earned')}</Text>
            : <Text style={styles.progress}>{Math.min(b.value, b.threshold)}/{b.threshold}</Text>}
        </View>
      ))}
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 },
    tile: { width: '31%', alignItems: 'center' },
    coin: { width: 58, height: 58, borderRadius: 29, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    emoji: { fontSize: 27 },
    name: { fontSize: 11.5, fontWeight: '700', color: c.heading, textAlign: 'center', lineHeight: 15 },
    earned: { fontSize: 11, fontWeight: '800', color: c.primary, marginTop: 2 },
    progress: { fontSize: 11, fontWeight: '700', color: c.textMuted, marginTop: 2 },
  });
}
