// Untere Tab-Leiste: schlicht & TRANSPARENT (kein Panel, kein Blur, keine Pille) - Icon oben,
// Label darunter, aktiver Reiter in der Akzentfarbe (wie eine klassische iOS-Leiste). Wechsel
// per TIPPEN ODER WISCHEN. Bewusst OHNE Animation/Vermessung -> kein Lag. Bereiche bleiben
// gemountet (sofortiger Wechsel); beim Aktivieren springt der Reiter per focusTick zurueck.
import { useRef, useState, ReactNode } from 'react';
import { PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../contexts/ThemeContext';
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
  const t = useT();
  const insets = useSafeAreaInsets();

  const TAB_LABEL: Record<Tab, string> = {
    home: t('tabs.start'), training: t('tabs.training'), essen: t('tabs.food'), progress: t('tabs.progress'), settings: t('tabs.settings'),
  };
  const idxRef = useRef(0);
  idxRef.current = TAB_ORDER.indexOf(tab);

  const go = (target: Tab, seg?: EssenSeg) => {
    setMounted((m) => (m[target] ? m : { ...m, [target]: true }));
    if (target === 'essen') setEssenSeg(seg ?? 'tracker');
    setTicks((k) => ({ ...k, [target]: k[target] + 1 }));
    setTab(target);
  };

  // Wischen auf der Leiste: nach links = naechster Reiter, nach rechts = vorheriger.
  // (Ref, damit der einmalig erstellte PanResponder immer den aktuellen Index nutzt.)
  const goRelRef = useRef((dir: number) => {
    const next = Math.min(TAB_ORDER.length - 1, Math.max(0, idxRef.current + dir));
    if (next !== idxRef.current) go(TAB_ORDER[next]);
  });
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -36 || g.vx < -0.3) goRelRef.current(1);       // links wischen -> naechster
        else if (g.dx >= 36 || g.vx > 0.3) goRelRef.current(-1);   // rechts wischen -> vorheriger
      },
    })
  ).current;

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
      {/* Transparente Leiste: Icon oben + Label darunter, aktiv in Akzentfarbe; tippen oder wischen */}
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]} {...pan.panHandlers}>
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
              <Ionicons name={(active ? TAB_ICON[k] : `${TAB_ICON[k]}-outline`) as any} size={25} color={color} />
              <Text style={[styles.label, { color, fontWeight: active ? '700' : '600' }]} numberOfLines={1}>{TAB_LABEL[k]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <StepsPrompt />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  pageHidden: { flex: 1, display: 'none' },
  // Transparent: kein Hintergrund, kein Rand, kein Blur.
  tabBar: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 9, paddingHorizontal: 6 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 4 },
  label: { fontSize: 11, letterSpacing: 0.2 },
});
