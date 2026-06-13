// Untere Tab-Leiste (Liquid Glass) - 5 Reiter. Wechsel per TIPPEN ODER WISCHEN auf der Leiste;
// die Smaragd-"Glas"-Pille gleitet animiert zum aktiven Reiter (Apple-Stil). Bereiche bleiben
// gemountet (sofortiger Wechsel); beim Aktivieren springt der Reiter per focusTick auf seine
// Startansicht zurueck und laedt leise neu.
import { useEffect, useRef, useState, ReactNode } from 'react';
import { Animated, LayoutAnimation, PanResponder, Platform, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';
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

// Layout-Animationen (Pillen-/Label-Uebergang) auch auf Android aktivieren.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const t = useT();
  const insets = useSafeAreaInsets();

  const TAB_LABEL: Record<Tab, string> = {
    home: t('tabs.start'), training: t('tabs.training'), essen: t('tabs.food'), progress: t('tabs.progress'), settings: t('tabs.settings'),
  };
  const activeIndex = TAB_ORDER.indexOf(tab);
  const idxRef = useRef(activeIndex);
  idxRef.current = activeIndex;

  // Reiter aktivieren: erstmalig mounten, focusTick erhoehen (-> Startansicht + leiser Refresh),
  // anzeigen. Die Layout-Animation laesst Pille + Label weich uebergehen.
  const go = (target: Tab, seg?: EssenSeg) => {
    LayoutAnimation.configureNext({
      duration: 260,
      update: { type: LayoutAnimation.Types.spring, springDamping: 0.78 },
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
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
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.3,
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -36 || g.vx < -0.25) goRelRef.current(1);       // links wischen -> naechster
        else if (g.dx >= 36 || g.vx > 0.25) goRelRef.current(-1);   // rechts wischen -> vorheriger
      },
    })
  ).current;

  // Gleitende "Glas"-Pille hinter dem aktiven Reiter: an gemessene Positionen springen.
  const [layouts, setLayouts] = useState<Array<{ x: number; w: number }>>([]);
  const pillX = useRef(new Animated.Value(0)).current;
  const pillW = useRef(new Animated.Value(0)).current;
  const pillInit = useRef(false);
  useEffect(() => {
    const L = layouts[activeIndex];
    if (!L) return;
    if (!pillInit.current) { pillInit.current = true; pillX.setValue(L.x); pillW.setValue(L.w); return; }
    Animated.parallel([
      Animated.spring(pillX, { toValue: L.x, useNativeDriver: false, speed: 16, bounciness: 9 }),
      Animated.spring(pillW, { toValue: L.w, useNativeDriver: false, speed: 16, bounciness: 9 }),
    ]).start();
  }, [activeIndex, layouts]);
  const onTabLayout = (i: number, x: number, w: number) => {
    setLayouts((prev) => {
      if (prev[i] && Math.abs(prev[i].x - x) < 0.5 && Math.abs(prev[i].w - w) < 0.5) return prev;
      const next = prev.slice(); next[i] = { x, w }; return next;
    });
  };

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
      {/* Schwebende Glas-Leiste: tippen oder wischen; die Pille gleitet zum aktiven Reiter */}
      <View style={[styles.tabWrap, { borderColor: c.hairline, marginBottom: Math.max(insets.bottom - 4, 12) }]} {...pan.panHandlers}>
        <BlurView intensity={dark ? 40 : 60} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(15,20,25,0.86)' : 'rgba(255,255,255,0.72)' }]} pointerEvents="none" />
        <View style={styles.tabRow}>
          {!!layouts[activeIndex] && (
            <Animated.View pointerEvents="none" style={[styles.pill, { backgroundColor: c.primary, transform: [{ translateX: pillX }], width: pillW }]} />
          )}
          {TAB_ORDER.map((k, i) => {
            const active = tab === k;
            return (
              <TouchableOpacity
                key={k}
                onLayout={(e) => onTabLayout(i, e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                onPress={() => go(k)}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={TAB_LABEL[k]}
              >
                <Ionicons name={(active ? TAB_ICON[k] : `${TAB_ICON[k]}-outline`) as any} size={active ? 20 : 22} color={active ? c.onPrimary : c.textMuted} />
                {active && <Text style={[styles.tabActiveLabel, { color: c.onPrimary }]} numberOfLines={1}>{TAB_LABEL[k]}</Text>}
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
  tabWrap: { marginHorizontal: 14, marginTop: 6, padding: 8, borderRadius: 26, borderWidth: 1, overflow: 'hidden' },
  tabRow: { flexDirection: 'row', alignItems: 'center' },
  pill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 18 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 18 },
  tabBtnActive: { flex: 0, gap: 7, paddingHorizontal: 16 },
  tabActiveLabel: { fontSize: 12, fontWeight: '800' },
});
