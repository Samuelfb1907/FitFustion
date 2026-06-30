// Wochen-Bingo (#76c): 3x3-Raster der Wochen-Aufgaben. Erledigte Felder farbig + Haken,
// offene ausgegraut mit Fortschritt. Selbst-ladend; Feier bei neuer Reihe / voller Karte
// uebernimmt der Host (Konfetti). Reiter/Karte auf dem Fortschritt-Tab.
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import { BingoCell } from '../lib/bingo';

export default function WeeklyBingo({ cells, lines, full }: { cells: BingoCell[]; lines: number; full: boolean }) {
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View>
      <Text style={styles.status}>{full ? t('bingo.full') : t('bingo.lineStatus', { n: lines })}</Text>
      <View style={styles.grid}>
        {cells.map((cell) => (
          <View key={cell.key} style={[styles.cell, cell.done ? { backgroundColor: c.accent + '22', borderColor: c.accent } : { backgroundColor: c.inputBg, borderColor: c.border }]}>
            {cell.done && <Ionicons name="checkmark-circle" size={15} color={c.accent} style={styles.check} />}
            <Text style={[styles.emoji, !cell.done && { opacity: 0.4 }]}>{cell.emoji}</Text>
            <Text style={[styles.label, { color: cell.done ? c.heading : c.textMuted }]} numberOfLines={2}>{t(`bingo.task.${cell.key}`)}</Text>
            {!cell.done && <Text style={styles.prog}>{Math.min(cell.value, cell.target)}/{cell.target}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    status: { fontSize: 13, fontWeight: '800', color: c.primary, marginBottom: 12 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
    cell: { width: '31.5%', aspectRatio: 1, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 8 },
    check: { position: 'absolute', top: 5, right: 5 },
    emoji: { fontSize: 24, marginBottom: 4 },
    label: { fontSize: 10.5, fontWeight: '700', textAlign: 'center', lineHeight: 13 },
    prog: { fontSize: 10, fontWeight: '700', color: c.textMuted, marginTop: 3 },
  });
}
