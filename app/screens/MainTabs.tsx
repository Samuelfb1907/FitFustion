// Untere Tab-Leiste (themed). Profil steckt jetzt in den Einstellungen (kein eigener Reiter).
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors, Colors } from '../contexts/ThemeContext';
import HomeScreen from './HomeScreen';
import TrainingScreen from './TrainingScreen';
import PlanScreen from './PlanScreen';
import NutritionScreen from './NutritionScreen';
import FoodTrackerScreen from './FoodTrackerScreen';
import SettingsScreen from './SettingsScreen';

type Tab = 'home' | 'training' | 'plan' | 'nutrition' | 'tracker' | 'settings';

function TabButton({ label, icon, active, onPress, c }: { label: string; icon: string; active: boolean; onPress: () => void; c: Colors }) {
  return (
    <TouchableOpacity style={styles.tabBtn} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.tabIcon, { opacity: active ? 1 : 0.45 }]}>{icon}</Text>
      <Text style={[styles.tabLabel, { color: active ? c.heading : c.textMuted, fontWeight: active ? '700' : '400' }]} numberOfLines={1}>
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
        {tab === 'home' ? <HomeScreen /> : null}
        {tab === 'training' ? <TrainingScreen /> : null}
        {tab === 'plan' ? <PlanScreen /> : null}
        {tab === 'nutrition' ? <NutritionScreen /> : null}
        {tab === 'tracker' ? <FoodTrackerScreen /> : null}
        {tab === 'settings' ? <SettingsScreen /> : null}
      </View>
      <View style={[styles.tabBar, { backgroundColor: c.card, borderTopColor: c.border }]}>
        <TabButton label="Start" icon="🏠" active={tab === 'home'} onPress={() => setTab('home')} c={c} />
        <TabButton label="Training" icon="💪" active={tab === 'training'} onPress={() => setTab('training')} c={c} />
        <TabButton label="Plan" icon="📅" active={tab === 'plan'} onPress={() => setTab('plan')} c={c} />
        <TabButton label="Essen" icon="🍽️" active={tab === 'nutrition'} onPress={() => setTab('nutrition')} c={c} />
        <TabButton label="Tracker" icon="🍎" active={tab === 'tracker'} onPress={() => setTab('tracker')} c={c} />
        <TabButton label="Einstellungen" icon="⚙️" active={tab === 'settings'} onPress={() => setTab('settings')} c={c} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, paddingBottom: 12 },
  tabBtn: { flex: 1, alignItems: 'center', paddingHorizontal: 1 },
  tabIcon: { fontSize: 18 },
  tabLabel: { fontSize: 9, marginTop: 2 },
});
