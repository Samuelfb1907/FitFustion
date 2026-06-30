// Einklappbare Karte fuer den Fortschritt-Tab: Kopf (Icon + Titel + Pfeil) ist antippbar,
// der Inhalt klappt auf/zu. Der Zustand wird pro Sektion gemerkt (AsyncStorage), damit
// die Wahl ueber Sitzungen erhalten bleibt. Optik identisch zu styles.card in ProgressScreen.
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { LayoutAnimation, Platform, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors, Colors } from '../contexts/ThemeContext';
import GlassFill from './GlassFill';
import { CARD_SHADOW as shadow } from '../lib/ui';
import { hTap } from '../lib/haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CollapsibleCard({
  icon, title, tint, storageKey, defaultCollapsed, children,
}: {
  icon: string;
  title: string;
  tint?: string;
  storageKey: string;
  defaultCollapsed?: boolean;
  children: ReactNode;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [collapsed, setCollapsed] = useState(!!defaultCollapsed);

  useEffect(() => {
    AsyncStorage.getItem('fitavo.pc.' + storageKey)
      .then((v) => { if (v === '0' || v === '1') setCollapsed(v === '1'); })
      .catch(() => {});
  }, [storageKey]);

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.create(180, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    setCollapsed((prev) => {
      const next = !prev;
      AsyncStorage.setItem('fitavo.pc.' + storageKey, next ? '1' : '0').catch(() => {});
      return next;
    });
    hTap();
  }

  return (
    <View style={styles.card}>
      <GlassFill radius={20} />
      <TouchableOpacity
        style={[styles.head, !collapsed && styles.headOpen]}
        onPress={toggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        accessibilityLabel={title}
      >
        <Ionicons name={icon as any} size={14} color={tint ?? c.textMuted} />
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={18} color={c.textMuted} />
      </TouchableOpacity>
      {!collapsed && <View>{children}</View>}
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    card: { ...shadow, backgroundColor: c.card, borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    head: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    headOpen: { marginBottom: 12 },
    title: { flex: 1, fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: c.textMuted, textTransform: 'uppercase' },
  });
}
