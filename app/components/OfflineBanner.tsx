// Schmaler Hinweis-Balken oben, wenn das Geraet KEINE Internetverbindung hat.
// Global in App.tsx eingehaengt -> erscheint auf jedem Screen. Blockiert keine Taps.
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useColors } from '../contexts/ThemeContext';

export default function OfflineBanner() {
  const c = useColors();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // Nur als offline werten, wenn eindeutig keine Verbindung besteht
    // (isConnected ist anfangs null -> dann KEINEN Fehlalarm zeigen).
    const unsub = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false);
    });
    return () => unsub();
  }, []);

  if (!offline) return null;
  return (
    <View
      style={[styles.bar, { backgroundColor: c.danger, paddingTop: Platform.OS === 'ios' ? 50 : 12 }]}
      pointerEvents="none"
      accessibilityRole="alert"
    >
      <Text style={styles.txt}>Keine Internetverbindung</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: 8, alignItems: 'center', zIndex: 1000 },
  txt: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
