// Zeigt den vollständigen Haftungsausschluss (aus lib/legal.ts). Wiederverwendet in
// Einstellungen > Rechtliches und im Registrieren-Dialog.
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../contexts/ThemeContext';
import { DISCLAIMER_SECTIONS } from '../lib/legal';

export default function LegalText({ c, sections = DISCLAIMER_SECTIONS }: { c: Colors; sections?: { h: string; p: string }[] }) {
  return (
    <View>
      {sections.map((s, i) => (
        <View key={i} style={styles.block}>
          <Text style={[styles.h, { color: c.heading }]}>{s.h}</Text>
          <Text style={[styles.p, { color: c.text }]}>{s.p}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 14 },
  h: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  p: { fontSize: 14, lineHeight: 21 },
});
