// Einmaliger Dialog beim ersten Start: fragt, ob der Schrittzaehler aktiviert werden soll.
// Zeigt sich NUR, wenn die Plattform Schritte unterstuetzt, die Berechtigung noch fehlt und
// der Dialog noch nie gezeigt wurde (Flag in AsyncStorage). "Aktivieren" startet die echte
// Berechtigungsabfrage (iOS: Bewegung & Fitness; Android: Health Connect).
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import { healthSupported, hasStepsPermission, requestHealthPermission } from '../lib/health';

const SEEN_KEY = 'fitavo.stepsPromptSeen';

export default function StepsPrompt() {
  const c = useColors();
  const t = useT();
  const styles = makeStyles(c);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!healthSupported()) return; // Plattform unterstuetzt keine Schritte (z. B. Expo Go)
        const seen = await AsyncStorage.getItem(SEEN_KEY);
        if (seen) return;
        const granted = await hasStepsPermission();
        if (granted) { await AsyncStorage.setItem(SEEN_KEY, '1'); return; } // schon erlaubt -> nicht fragen
        if (!cancelled) setVisible(true);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  async function markSeen() {
    try { await AsyncStorage.setItem(SEEN_KEY, '1'); } catch {}
  }
  async function enable() {
    if (busy) return;
    setBusy(true);
    try { await requestHealthPermission(); } catch {}
    setBusy(false);
    await markSeen();
    setVisible(false);
  }
  async function later() {
    await markSeen();
    setVisible(false);
  }

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={later}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.icon}>🚶</Text>
          <Text style={styles.title}>{t('stepsPrompt.title')}</Text>
          <Text style={styles.body}>{t('stepsPrompt.body')}</Text>
          <Text style={styles.importance}>{t('stepsPrompt.importance')}</Text>
          <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={enable} disabled={busy} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('stepsPrompt.enable')}>
            {busy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.primaryText}>{t('stepsPrompt.enable')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={later} style={styles.laterBtn} accessibilityRole="button" accessibilityLabel={t('stepsPrompt.later')}>
            <Text style={styles.laterText}>{t('stepsPrompt.later')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 28 },
    sheet: { backgroundColor: c.bg, borderRadius: 22, padding: 24, borderWidth: 1, borderColor: c.cardBorder, alignItems: 'center' },
    icon: { fontSize: 40, marginBottom: 8 },
    title: { fontSize: 20, fontWeight: '800', color: c.heading, textAlign: 'center', marginBottom: 10 },
    body: { fontSize: 15, color: c.text, lineHeight: 21, textAlign: 'center', marginBottom: 12 },
    importance: { fontSize: 13, color: c.textMuted, lineHeight: 18, textAlign: 'center', marginBottom: 20, fontWeight: '600' },
    primaryBtn: { backgroundColor: c.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center', alignSelf: 'stretch' },
    primaryText: { color: c.onPrimary, fontSize: 16, fontWeight: '800' },
    laterBtn: { marginTop: 12, paddingVertical: 6 },
    laterText: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
  });
}
