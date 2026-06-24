// Ruhige Sektions-Beschriftung (kleines Icon + Text in Normalschrift). Bewusst dezent,
// damit gestapelte Abschnitte ordentlich statt schreiend wirken.
import { Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../contexts/ThemeContext';

export default function SectionHead({ icon, title, tint }: { icon: string; title: string; tint?: string }) {
  const c = useColors();
  return (
    <View style={styles.row}>
      <Ionicons name={icon as any} size={15} color={tint ?? c.primary} />
      <Text style={[styles.title, { color: c.textMuted }]} numberOfLines={1}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  title: { fontSize: 13, fontWeight: '700', flex: 1 },
});
