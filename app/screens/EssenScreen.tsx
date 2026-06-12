// Essen-Hub: oben umschalten zwischen Tracker (Tagebuch) und Wasser.
// Beide Unter-Screens bleiben gemountet (sofortiges Umschalten, Zustand bleibt erhalten).
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import Segmented from '../components/Segmented';
import FoodTrackerScreen from './FoodTrackerScreen';
import WaterScreen from './WaterScreen';
import ProteinScreen from './ProteinScreen';
import { useFocusTick } from '../lib/useFocusTick';

type Seg = 'tracker' | 'protein' | 'water';

export default function EssenScreen({ focusTick }: { focusTick?: number }) {
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [seg, setSeg] = useState<Seg>('tracker');

  // Reiter erneut angetippt -> zurueck zum Tracker
  useFocusTick(focusTick, () => setSeg('tracker'));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('essen.title')}</Text>
      <View style={{ height: 14 }} />
      <Segmented
        options={[
          { key: 'tracker', label: t('essen.segTracker') },
          { key: 'protein', label: t('essen.segProtein') },
          { key: 'water', label: t('essen.segWater') },
        ]}
        value={seg}
        onChange={(k) => setSeg(k as Seg)}
        c={c}
      />
      <View style={{ flex: 1, marginTop: 14 }}>
        <View style={[styles.page, seg !== 'tracker' && styles.hidden]}><FoodTrackerScreen embedded focusTick={focusTick} /></View>
        <View style={[styles.page, seg !== 'protein' && styles.hidden]}><ProteinScreen embedded /></View>
        <View style={[styles.page, seg !== 'water' && styles.hidden]}><WaterScreen embedded focusTick={focusTick} /></View>
      </View>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent', paddingTop: 60, paddingHorizontal: 20 },
    title: { fontSize: 26, fontWeight: 'bold', color: c.heading },
    page: { flex: 1 },
    hidden: { display: 'none' },
  });
}
