// Essen-Hub: oben umschalten zwischen Tracker (Tagebuch) und Ernaehrungsplan.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors, Colors } from '../contexts/ThemeContext';
import Segmented from '../components/Segmented';
import NutritionScreen from './NutritionScreen';
import FoodTrackerScreen from './FoodTrackerScreen';
import RecipesScreen from './RecipesScreen';

export default function EssenScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const [seg, setSeg] = useState<'tracker' | 'recipes' | 'plan'>('tracker');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Essen</Text>
      <View style={{ height: 14 }} />
      <Segmented
        options={[{ key: 'tracker', label: 'Tracker' }, { key: 'recipes', label: 'Rezepte' }, { key: 'plan', label: 'Ernährungsplan' }]}
        value={seg}
        onChange={(k) => setSeg(k as 'tracker' | 'recipes' | 'plan')}
        c={c}
      />
      <View style={{ flex: 1, marginTop: 14 }}>
        {seg === 'tracker' ? <FoodTrackerScreen embedded /> : seg === 'recipes' ? <RecipesScreen embedded /> : <NutritionScreen embedded />}
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
