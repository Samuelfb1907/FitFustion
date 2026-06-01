// Wiederverwendbare Fehler-Ansicht mit "Erneut versuchen"-Knopf.
// Wird gezeigt, wenn das Laden der Daten fehlschlaegt – statt eines endlosen Lade-Kreisels.
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors, Colors } from '../contexts/ThemeContext';

export default function ErrorRetry({
  message,
  onRetry,
  embedded,
}: {
  message?: string;
  onRetry: () => void;
  embedded?: boolean;
}) {
  const c = useColors();
  const s = makeStyles(c);
  return (
    <View style={[s.wrap, embedded && s.embedded]}>
      <Text style={s.icon}>⚠️</Text>
      <Text style={s.title}>Etwas ist schiefgelaufen</Text>
      <Text style={s.msg}>{message ?? 'Die Daten konnten nicht geladen werden.'}</Text>
      <TouchableOpacity
        style={s.btn}
        onPress={onRetry}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Erneut versuchen"
      >
        <Text style={s.btnText}>Erneut versuchen</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 },
    embedded: { paddingVertical: 32 },
    icon: { fontSize: 40, marginBottom: 12 },
    title: { fontSize: 17, fontWeight: '700', color: c.heading, marginBottom: 6, textAlign: 'center' },
    msg: { fontSize: 14, color: c.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    btn: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
    btnText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
  });
}
