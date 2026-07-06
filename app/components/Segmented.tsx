// Wiederverwendbare Umschalt-Leiste (Pillen-Stil) fuer Unter-Tabs - Liquid-Glass-Look.
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../contexts/ThemeContext';
import Glass from './Glass';

export type SegOption = { key: string; label: string; dot?: boolean };

export default function Segmented({
  options,
  value,
  onChange,
  c,
}: {
  options: SegOption[];
  value: string;
  onChange: (key: string) => void;
  c: Colors;
}) {
  return (
    <Glass radius={16} style={styles.wrap}>
      <View style={styles.row}>
        {options.map((o) => {
          const active = o.key === value;
          return (
            <TouchableOpacity
              key={o.key}
              activeOpacity={0.85}
              onPress={() => onChange(o.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={o.label}
              style={[styles.seg, active && { backgroundColor: c.primary }]}
            >
              <View style={styles.segInner}>
                <Text numberOfLines={1} style={[styles.label, { color: active ? c.onPrimary : c.textMuted, fontWeight: active ? '800' : '600' }]}>
                  {o.label}
                </Text>
                {o.dot && <View style={styles.dot} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 5 },
  row: { flexDirection: 'row', gap: 4 },
  seg: { flex: 1, minHeight: 40, paddingVertical: 9, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  label: { fontSize: 13, fontWeight: '700' },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#F0574B' },
});
