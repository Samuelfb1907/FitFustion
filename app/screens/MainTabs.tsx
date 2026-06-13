// Untere Tab-Leiste im "Liquid Glass"-Stil (wie Apple Music): schwebende, durchscheinende
// Glas-Leiste, Icon + Label je Reiter, der AKTIVE Reiter ist eine gruene Pille, die beim
// Antippen smooth zum Reiter GLEITET (nur translateX -> nativ animiert -> KEIN Lag).
// Die Leiste schwebt ueber dem Inhalt (absolute), der Inhalt scrollt durch das Glas durch.
import { useEffect, useRef, useState, ReactNode } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, useTheme } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import HomeScreen from './HomeScreen';
import TrainingScreen from './TrainingScreen';
import EssenScreen, { Seg as EssenSeg } from './EssenScreen';
import ProgressScreen from './ProgressScreen';
import SettingsScreen from './SettingsScreen';
import Ambient from '../components/Ambient';
import StepsPrompt from '../components/StepsPrompt';

type Tab = 'home' | 'training' | 'essen' | 'progress' | 'settings';
const TAB_ORDER: Tab[] = ['home', 'training', 'essen', 'progress', 'settings'];
const TAB_ICON: Record<Tab, string> = { home: 'home', training: 'barbell', essen: 'restaurant', progress: 'stats-chart', settings: 'settings' };
const BAR_H = 58;

// Haelt den Bereich gemountet, blendet ihn aber aus, wenn nicht aktiv (Zustand bleibt erhalten).
function Page({ active, children }: { active: boolean; children: ReactNode }) {
  return <View style={active ? styles.page : styles.pageHidden}>{children}</View>;
}

export default function MainTabs() {
  const [tab, setTab] = useState<Tab>('home');
  const [mounted, setMounted] = useState<Record<Tab, boolean>>({ home: true, training: false, essen: false, progress: false, settings: false });
  const [ticks, setTicks] = useState<Record<Tab, number>>({ home: 0, training: 0, essen: 0, progress: 0, settings: 0 });
  const [essenSeg, setEssenSeg] = useState<EssenSeg>('tracker'); // welcher Unter-Reiter im Essen-Hub geoeffnet wird
  const c = useColors();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const t = useT();
  const insets = useSafeAreaInsets();

  const TAB_LABEL: Record<Tab, string> = {
    home: t('tabs.start'), training: t('tabs.training'), essen: t('tabs.food'), progress: t('tabs.progress'), settings: t('tabs.settings'),
  };
  const activeIndex = TAB_ORDER.indexOf(tab);

  const go = (target: Tab, seg?: EssenSeg) => {
    setMounted((m) => (m[target] ? m : { ...m, [target]: true }));
    if (target === 'essen') setEssenSeg(seg ?? 'tracker');
    setTicks((k) => ({ ...k, [target]: k[target] + 1 }));
    setTab(target);
  };

  // Gleitende Pille: nur translateX (nativ animiert -> butterweich, kein Lag).
  const [barW, setBarW] = useState(0);
  const tabW = barW > 0 ? barW / TAB_ORDER.length : 0;
  const pillX = useRef(new Animated.Value(0)).current;
  const pillInit = useRef(false);
  useEffect(() => {
    if (tabW <= 0) return;
    const to = activeIndex * tabW;
    if (!pillInit.current) { pillInit.current = true; pillX.setValue(to); return; } // beim ersten Messen ohne Animation setzen
    Animated.spring(pillX, { toValue: to, useNativeDriver: true, speed: 18, bounciness: 9 }).start();
  }, [activeIndex, tabW]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Ambient c={c} />
      <View style={{ flex: 1 }}>
        {mounted.home && <Page active={tab === 'home'}><HomeScreen onNavigate={(tb, seg) => go(tb as Tab, seg as EssenSeg | undefined)} focusTick={ticks.home} /></Page>}
        {mounted.training && <Page active={tab === 'training'}><TrainingScreen focusTick={ticks.training} /></Page>}
        {mounted.essen && <Page active={tab === 'essen'}><EssenScreen focusTick={ticks.essen} initialSeg={essenSeg} /></Page>}
        {mounted.progress && <Page active={tab === 'progress'}><ProgressScreen focusTick={ticks.progress} /></Page>}
        {mounted.settings && <Page active={tab === 'settings'}><SettingsScreen focusTick={ticks.settings} /></Page>}
      </View>
      {/* Schwebende Glas-Leiste ueber dem Inhalt; box-none -> nur die Reiter fangen Tipps ab */}
      <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
        <View style={[styles.bar, { borderColor: c.hairline }]} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
          {/* Nur Milchglas (durchscheinend) - KEINE dunkle Fuellung mehr -> der Inhalt schimmert durch. */}
          <BlurView intensity={dark ? 34 : 48} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          {tabW > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[styles.pill, { width: tabW - 12, backgroundColor: dark ? 'rgba(25,201,143,0.20)' : 'rgba(14,159,110,0.15)', transform: [{ translateX: pillX }] }]}
            />
          )}
          {TAB_ORDER.map((k) => {
            const active = tab === k;
            const color = active ? c.primary : c.textMuted;
            return (
              <TouchableOpacity
                key={k}
                style={styles.tab}
                onPress={() => go(k)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={TAB_LABEL[k]}
              >
                <Ionicons name={(active ? TAB_ICON[k] : `${TAB_ICON[k]}-outline`) as any} size={23} color={color} />
                <Text style={[styles.label, { color, fontWeight: active ? '700' : '600' }]} numberOfLines={1}>{TAB_LABEL[k]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <StepsPrompt />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  pageHidden: { flex: 1, display: 'none' },
  barWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  bar: { flexDirection: 'row', height: BAR_H, borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  // Gruene Pille hinter dem aktiven Reiter; marginLeft zentriert sie in der Reiter-Spalte.
  pill: { position: 'absolute', top: 7, bottom: 7, left: 0, marginLeft: 6, borderRadius: 17 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 11, letterSpacing: 0.2 },
});
