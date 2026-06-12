// Untere Tab-Leiste (Liquid Glass) - 5 Reiter. Bereiche bleiben gemountet (sofortiger Wechsel);
// beim Antippen springt der Reiter per focusTick auf seine Startansicht zurueck und laedt leise neu.
import { useState, ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, useTheme, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import HomeScreen from './HomeScreen';
import TrainingScreen from './TrainingScreen';
import EssenScreen from './EssenScreen';
import ProgressScreen from './ProgressScreen';
import SettingsScreen from './SettingsScreen';
import Ambient from '../components/Ambient';
import StepsPrompt from '../components/StepsPrompt';

type Tab = 'home' | 'training' | 'essen' | 'progress' | 'settings';

// Aktiver Reiter = Smaragd-Pille mit Icon + Label, inaktive = ruhige Icons.
function TabButton({ label, icon, active, onPress, c }: { label: string; icon: string; active: boolean; onPress: () => void; c: Colors }) {
  if (active) {
    return (
      <TouchableOpacity style={[styles.tabActive, { backgroundColor: c.primary }]} onPress={onPress} activeOpacity={0.85} accessibilityRole="tab" accessibilityState={{ selected: true }} accessibilityLabel={label}>
        <Ionicons name={icon as any} size={20} color={c.onPrimary} />
        <Text style={[styles.tabActiveLabel, { color: c.onPrimary }]} numberOfLines={1}>{label}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity style={styles.tabBtn} onPress={onPress} activeOpacity={0.7} accessibilityRole="tab" accessibilityState={{ selected: false }} accessibilityLabel={label}>
      <Ionicons name={`${icon}-outline` as any} size={22} color={c.textMuted} />
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
  const t = useT();
  const insets = useSafeAreaInsets();

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
      {/* Schwebende Tab-Leiste (abgerundet, mit Rand) statt durchgehender Bodenleiste */}
      <View style={[styles.tabWrap, { borderColor: c.hairline, marginBottom: Math.max(insets.bottom - 4, 12) }]}>
        <BlurView intensity={dark ? 40 : 60} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(15,20,25,0.86)' : 'rgba(255,255,255,0.72)' }]} pointerEvents="none" />
        <TabButton label={t('tabs.start')} icon="home" active={tab === 'home'} onPress={() => go('home')} c={c} />
        <TabButton label={t('tabs.training')} icon="barbell" active={tab === 'training'} onPress={() => go('training')} c={c} />
        <TabButton label={t('tabs.food')} icon="restaurant" active={tab === 'essen'} onPress={() => go('essen')} c={c} />
        <TabButton label={t('tabs.progress')} icon="stats-chart" active={tab === 'progress'} onPress={() => go('progress')} c={c} />
        <TabButton label={t('tabs.settings')} icon="settings" active={tab === 'settings'} onPress={() => go('settings')} c={c} />
      </View>
      <StepsPrompt />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  pageHidden: { flex: 1, display: 'none' },
  tabWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 14, marginTop: 6, padding: 8, borderRadius: 26, borderWidth: 1, overflow: 'hidden' },
  tabActive: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 18 },
  tabActiveLabel: { fontSize: 12, fontWeight: '800' },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
});
