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
  // nonce wechselt bei jedem Tab-Tipp -> der key des Screens aendert sich -> frischer Mount (zurueck zur Startansicht)
  const [nonce, setNonce] = useState(0);
  const c = useColors();

  const go = (t: Tab) => { setTab(t); setNonce((n) => n + 1); };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flex: 1 }}>
        {tab === 'home' ? <HomeScreen key={`home-${nonce}`} onNavigate={(t) => go(t as Tab)} /> : null}
        {tab === 'training' ? <TrainingScreen key={`training-${nonce}`} /> : null}
        {tab === 'essen' ? <EssenScreen key={`essen-${nonce}`} /> : null}
        {tab === 'progress' ? <ProgressScreen key={`progress-${nonce}`} /> : null}
        {tab === 'settings' ? <SettingsScreen key={`settings-${nonce}`} /> : null}
      </View>
      <View style={[styles.tabBar, { backgroundColor: c.card, borderTopColor: c.border }]}>
        <TabButton label="Start" icon="🏠" active={tab === 'home'} onPress={() => go('home')} c={c} />
        <TabButton label="Training" icon="💪" active={tab === 'training'} onPress={() => go('training')} c={c} />
        <TabButton label="Essen" icon="🍽️" active={tab === 'essen'} onPress={() => go('essen')} c={c} />
        <TabButton label="Fortschritt" icon="📈" active={tab === 'progress'} onPress={() => go('progress')} c={c} />
        <TabButton label="Einstellungen" icon="⚙️" active={tab === 'settings'} onPress={() => go('settings')} c={c} />
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
