// Untere Tab-Leiste: wechselt zwischen den Haupt-Screens.
// (Bewusst einfach per useState gehalten – kein extra Navigations-Paket nötig.)
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import HomeScreen from './HomeScreen';
import TrainingScreen from './TrainingScreen';
import PlanScreen from './PlanScreen';
import NutritionScreen from './NutritionScreen';
import FoodTrackerScreen from './FoodTrackerScreen';

type Tab = 'home' | 'training' | 'plan' | 'nutrition' | 'tracker';

function TabButton({ label, icon, active, onPress }: { label: string; icon: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.tabBtn} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.tabIcon, { opacity: active ? 1 : 0.45 }]}>{icon}</Text>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function MainTabs() {
  const [tab, setTab] = useState<Tab>('home');
  return (
    <View style={styles.root}>
      <View style={styles.screen}>
        {tab === 'home' ? <HomeScreen /> : null}
        {tab === 'training' ? <TrainingScreen /> : null}
        {tab === 'plan' ? <PlanScreen /> : null}
        {tab === 'nutrition' ? <NutritionScreen /> : null}
        {tab === 'tracker' ? <FoodTrackerScreen /> : null}
      </View>
      <View style={styles.tabBar}>
        <TabButton label="Start" icon="🏠" active={tab === 'home'} onPress={() => setTab('home')} />
        <TabButton label="Training" icon="💪" active={tab === 'training'} onPress={() => setTab('training')} />
        <TabButton label="Plan" icon="📅" active={tab === 'plan'} onPress={() => setTab('plan')} />
        <TabButton label="Ernährung" icon="🍽️" active={tab === 'nutrition'} onPress={() => setTab('nutrition')} />
        <TabButton label="Tracker" icon="🍎" active={tab === 'tracker'} onPress={() => setTab('tracker')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  screen: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E3E9F2',
    backgroundColor: '#fff',
    paddingTop: 8,
    paddingBottom: 12,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingHorizontal: 1 },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 10, color: '#8A97A8', marginTop: 2 },
  tabLabelActive: { color: '#1F3864', fontWeight: '700' },
});
