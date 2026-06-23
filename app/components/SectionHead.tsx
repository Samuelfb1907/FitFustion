// Einheitliche Sektions-Kopfzeile (Icon im getoenten Kreis + Label). Sorgt fuer ein
// ruhiges, konsistentes Bild in Karten (Lobby/Freunde u. a.).
import { Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../contexts/ThemeContext';

export default function SectionHead({ icon, title, tint }: { icon: string; title: string; tint?: string }) {
  const c = useColors();
  const color = tint ?? c.primary;
  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon as any} size={15} color={color} />
      </View>
      <Text style={[styles.title, { color: c.heading }]} numberOfLines={1}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
  icon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3, flex: 1 },
});
