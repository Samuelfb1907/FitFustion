// Essen-Hub: oben umschalten zwischen Tracker (Tagebuch) und Wasser.
// Beide Unter-Screens bleiben gemountet (sofortiges Umschalten, Zustand bleibt erhalten).
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors, Colors } from '../contexts/ThemeContext';
import Segmented from '../components/Segmented';
import FoodTrackerScreen from './FoodTrackerScreen';
import WaterScreen from './WaterScreen';
import { useFocusTick } from '../lib/useFocusTick';

type Seg = 'tracker' | 'water';

export default function EssenScreen({ focusTick }: { focusTick?: number }) {
  const c = useColors();
  const styles = makeStyles(c);
  const [seg, setSeg] = useState<Seg>('tracker');

  // Reiter erneut angetippt -> zurueck zum Tracker
  useFocusTick(focusTick, () => setSeg('tracker'));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Essen</Text>
      <View style={{ height: 14 }} />
      <Segmented
        options={[
          { key: 'tracker', label: 'Tracker' },
          { key: 'water', label: 'Wasser' },
        ]}
        value={seg}
        onChange={(k) => setSeg(k as Seg)}
        c={c}
      />
      <View style={{ flex: 1, marginTop: 14 }}>
        <View style={[styles.page, seg !== 'tracker' && styles.hidden]}><FoodTrackerScreen embedded focusTick={focusTick} /></View>
        <View style={[styles.page, seg !== 'water' && styles.hidden]}><WaterScreen embedded focusTick={focusTick} /></View>
      </View>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 60, paddingHorizontal: 20 },
    title: { fontSize: 26, fontWeight: 'bold', color: c.heading },
    page: { flex: 1 },
    hidden: { display: 'none' },
  });
}
