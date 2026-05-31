// Wiederverwendbare Umschalt-Leiste (Pillen-Stil) fuer Unter-Tabs.
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../contexts/ThemeContext';

export type SegOption = { key: string; label: string };

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
    <View style={[styles.wrap, { backgroundColor: c.inputBg, borderColor: c.border }]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <TouchableOpacity
            key={o.key}
            activeOpacity={0.85}
            onPress={() => onChange(o.key)}
            style={[styles.seg, active && { backgroundColor: c.primary }]}
          >
            <Text numberOfLines={1} style={[styles.label, { color: active ? c.onPrimary : c.textMuted }]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', borderRadius: 12, padding: 4, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  seg: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '700' },
});
