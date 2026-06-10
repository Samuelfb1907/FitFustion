// Klarer, gut treffbarer Zurueck-Button (Chevron + Label) – app-weit einheitlich.
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Colors } from '../contexts/ThemeContext';

export default function BackButton({ onPress, c, label = 'Zurück' }: { onPress: () => void; c: Colors; label?: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      hitSlop={{ top: 16, bottom: 16, left: 16, right: 28 }}
      style={styles.btn}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.chev, { color: c.primary }]}>‹</Text>
      <Text style={[styles.label, { color: c.primary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 6, paddingRight: 14, marginBottom: 8 },
  chev: { fontSize: 30, fontWeight: '400', marginRight: 3, lineHeight: 32 },
  label: { fontSize: 17, fontWeight: '600' },
});
