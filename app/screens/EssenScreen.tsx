// Essen-Hub: oben umschalten zwischen Tracker (Tagebuch), Wasser und Rezepten.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors, Colors } from '../contexts/ThemeContext';
import Segmented from '../components/Segmented';
import FoodTrackerScreen from './FoodTrackerScreen';
import RecipesScreen from './RecipesScreen';
import WaterScreen from './WaterScreen';

type Seg = 'tracker' | 'water' | 'recipes';

export default function EssenScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const [seg, setSeg] = useState<Seg>('tracker');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Essen</Text>
      <View style={{ height: 14 }} />
      <Segmented
        options={[
          { key: 'tracker', label: 'Tracker' },
          { key: 'water', label: 'Wasser' },
          { key: 'recipes', label: 'Rezepte' },
        ]}
        value={seg}
        onChange={(k) => setSeg(k as Seg)}
        c={c}
      />
      <View style={{ flex: 1, marginTop: 14 }}>
        {seg === 'tracker' ? <FoodTrackerScreen embedded />
          : seg === 'water' ? <WaterScreen embedded />
          : <RecipesScreen embedded />}
      </View>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 60, paddingHorizontal: 20 },
    title: { fontSize: 26, fontWeight: 'bold', color: c.heading },
  });
}
