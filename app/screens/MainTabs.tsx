// Untere Tab-Leiste (Liquid Glass) - 5 Reiter. Bereiche bleiben gemountet (sofortiger Wechsel);
// beim Antippen springt der Reiter per focusTick auf seine Startansicht zurueck und laedt leise neu.
import { useState, ReactNode } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useColors, useTheme, Colors } from '../contexts/ThemeContext';
import HomeScreen from './HomeScreen';
import TrainingScreen from './TrainingScreen';
import EssenScreen from './EssenScreen';
import ProgressScreen from './ProgressScreen';
import SettingsScreen from './SettingsScreen';
import Ambient from '../components/Ambient';

type Tab = 'home' | 'training' | 'essen' | 'progress' | 'settings';

function TabButton({ label, icon, active, onPress, c }: { label: string; icon: string; active: boolean; onPress: () => void; c: Colors }) {
  return (
    <TouchableOpacity style={styles.tabBtn} onPress={onPress} activeOpacity={0.7} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label}>
      <Ionicons name={(active ? icon : `${icon}-outline`) as any} size={23} color={active ? c.primary : c.textMuted} style={{ marginBottom: 3 }} />
      <Text style={[styles.tabLabel, { color: active ? c.primary : c.textMuted, fontWeight: active ? '700' : '500' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Haelt den Bereich gemountet, blendet ihn aber aus, wenn nicht aktiv (Zustand bleibt erhalten).
function Page({ active, children }: { active: boolean; children: ReactNode }) {
  return <View style={active ? styles.page : styles.pageHidden}>{children}</View>;
}

export default function MainTabs() {
  const [tab, setTab] = useState<Tab>('home');
  const [mounted, setMounted] = useState<Record<Tab, boolean>>({ home: true, training: false, essen: false, progress: false, settings: false });
  const [ticks, setTicks] = useState<Record<Tab, number>>({ home: 0, training: 0, essen: 0, progress: 0, settings: 0 });
  const c = useColors();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  // Reiter aktivieren: erstmalig mounten, focusTick erhoehen (-> Startansicht + leiser Refresh), anzeigen.
  const go = (t: Tab) => {
    setMounted((m) => (m[t] ? m : { ...m, [t]: true }));
    setTicks((k) => ({ ...k, [t]: k[t] + 1 }));
    setTab(t);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Ambient c={c} />
      <View style={{ flex: 1 }}>
        {mounted.home && <Page active={tab === 'home'}><HomeScreen onNavigate={(t) => go(t as Tab)} focusTick={ticks.home} /></Page>}
        {mounted.training && <Page active={tab === 'training'}><TrainingScreen focusTick={ticks.training} /></Page>}
        {mounted.essen && <Page active={tab === 'essen'}><EssenScreen focusTick={ticks.essen} /></Page>}
        {mounted.progress && <Page active={tab === 'progress'}><ProgressScreen focusTick={ticks.progress} /></Page>}
        {mounted.settings && <Page active={tab === 'settings'}><SettingsScreen focusTick={ticks.settings} /></Page>}
      </View>
      <BlurView intensity={dark ? 40 : 60} tint={dark ? 'dark' : 'light'} style={styles.tabBar}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.glass, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline }]} pointerEvents="none" />
        <TabButton label="Start" icon="home" active={tab === 'home'} onPress={() => go('home')} c={c} />
        <TabButton label="Training" icon="barbell" active={tab === 'training'} onPress={() => go('training')} c={c} />
        <TabButton label="Essen" icon="restaurant" active={tab === 'essen'} onPress={() => go('essen')} c={c} />
        <TabButton label="Fortschritt" icon="stats-chart" active={tab === 'progress'} onPress={() => go('progress')} c={c} />
        <TabButton label="Einstellungen" icon="settings" active={tab === 'settings'} onPress={() => go('settings')} c={c} />
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  pageHidden: { flex: 1, display: 'none' },
  tabBar: { flexDirection: 'row', paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 12 },
  tabBtn: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  tabLabel: { fontSize: 10, marginTop: 2 },
});
