// Untere Tab-Leiste (themed) – 5 Reiter. Training & Essen sind Hubs mit Unter-Umschalter.
import { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors, Colors } from '../contexts/ThemeContext';
import HomeScreen from './HomeScreen';
import TrainingScreen from './TrainingScreen';
import EssenScreen from './EssenScreen';
import ProgressScreen from './ProgressScreen';
import SettingsScreen from './SettingsScreen';

type Tab = 'home' | 'training' | 'essen' | 'progress' | 'settings';

function TabButton({ label, icon, active, onPress, c }: { label: string; icon: string; active: boolean; onPress: () => void; c: Colors }) {
  return (
    <TouchableOpacity style={styles.tabBtn} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.tabIcon, { opacity: active ? 1 : 0.45 }]}>{icon}</Text>
      <Text style={[styles.tabLabel, { color: active ? c.primary : c.textMuted, fontWeight: active ? '700' : '500' }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function MainTabs() {
  const [tab, setTab] = useState<Tab>('home');
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flex: 1 }}>
        {tab === 'home' ? <HomeScreen onNavigate={(t) => setTab(t as Tab)} /> : null}
        {tab === 'training' ? <TrainingScreen /> : null}
        {tab === 'essen' ? <EssenScreen /> : null}
        {tab === 'progress' ? <ProgressScreen /> : null}
        {tab === 'settings' ? <SettingsScreen /> : null}
      </View>
      <View style={[styles.tabBar, { backgroundColor: c.card, borderTopColor: c.border }]}>
        <TabButton label="Start" icon="🏠" active={tab === 'home'} onPress={() => setTab('home')} c={c} />
        <TabButton label="Training" icon="💪" active={tab === 'training'} onPress={() => setTab('training')} c={c} />
        <TabButton label="Essen" icon="🍽️" active={tab === 'essen'} onPress={() => setTab('essen')} c={c} />
        <TabButton label="Fortschritt" icon="📈" active={tab === 'progress'} onPress={() => setTab('progress')} c={c} />
        <TabButton label="Einstellungen" icon="⚙️" active={tab === 'settings'} onPress={() => setTab('settings')} c={c} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 30 : 12 },
  tabBtn: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  tabIcon: { fontSize: 19 },
  tabLabel: { fontSize: 10, marginTop: 3 },
});
