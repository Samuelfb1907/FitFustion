// Untere Tab-Leiste: SCHWEBENDE Glas-Pille. Sie ist ABSOLUT positioniert und liegt FREI ueber
// dem Inhalt (kein eigener Hintergrund-Streifen, keine reservierte Flaeche) - der Inhalt laeuft
// bis ganz unten durch und scrollt hinter der Pille durch. Damit nichts verdeckt wird, lassen die
// Seiten unten TAB_BAR_SPACE Platz (siehe lib/layout). Pille = abgerundet + durchscheinend
// (BlurView) + zarte Lichtkante. Aktiver Reiter GRUEN, Rest grau. Tippen oder seitlich WISCHEN.
import { useRef, useState, ReactNode } from 'react';
import { PanResponder, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

  const go = (target: Tab, seg?: EssenSeg) => {
    setMounted((m) => (m[target] ? m : { ...m, [target]: true }));
    if (target === 'essen') setEssenSeg(seg ?? 'tracker');
    setTicks((k) => ({ ...k, [target]: k[target] + 1 }));
    setTab(target);
  };

  // Seitliches Wischen wechselt den Reiter. Bewusst NICHT im Capture-Modus -> Kind-Gesten
  // (Kalorien-Karte, Zurueck-Wischen, horizontale Listen) greifen zuerst.
  const idxRef = useRef(TAB_ORDER.indexOf(tab));
  idxRef.current = TAB_ORDER.indexOf(tab);
  const goRelRef = useRef((dir: number) => {
    const next = Math.min(TAB_ORDER.length - 1, Math.max(0, idxRef.current + dir));
    if (next !== idxRef.current) go(TAB_ORDER[next]);
  });
  const pageSwipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -55 || g.vx < -0.35) goRelRef.current(1);       // nach links -> naechste Kategorie
        else if (g.dx >= 55 || g.vx > 0.35) goRelRef.current(-1);   // nach rechts -> vorherige
      },
    })
  ).current;

  // Glas-Toenung: in Dunkel ein zarter heller Schimmer (Glas faengt Licht); in Hell frostig hell.
  const glassTint = dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.45)';
  // Android: expo-blur rendert die Pille oft komplett durchsichtig. Daher dort KEIN BlurView,
  // sondern ein solider (fast deckender) Hintergrund + dezente Elevation; iOS behaelt das Glas.
  const isAndroid = Platform.OS === 'android';
  const androidBarBg = dark ? 'rgba(18,24,30,0.96)' : 'rgba(255,255,255,0.96)';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Ambient c={c} />
      <View style={{ flex: 1 }} {...pageSwipe.panHandlers}>
        {mounted.home && <Page active={tab === 'home'}><HomeScreen onNavigate={(tb, seg) => go(tb as Tab, seg as EssenSeg | undefined)} focusTick={ticks.home} /></Page>}
        {mounted.training && <Page active={tab === 'training'}><TrainingScreen focusTick={ticks.training} /></Page>}
        {mounted.essen && <Page active={tab === 'essen'}><EssenScreen focusTick={ticks.essen} initialSeg={essenSeg} /></Page>}
        {mounted.progress && <Page active={tab === 'progress'}><ProgressScreen focusTick={ticks.progress} /></Page>}
        {mounted.settings && <Page active={tab === 'settings'}><SettingsScreen focusTick={ticks.settings} /></Page>}
      </View>
      {/* SCHWEBENDE Glas-Pille: absolut, liegt frei ueber dem Inhalt (kein Streifen drumherum) */}
      <View style={[styles.bar, { bottom: Math.max(insets.bottom, 12), borderColor: c.hairline }, isAndroid && { backgroundColor: androidBarBg, elevation: 4 }]}>
        {!isAndroid && <BlurView intensity={dark ? 32 : 52} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
        {!isAndroid && <View style={[StyleSheet.absoluteFill, { backgroundColor: glassTint }]} />}
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
              <Text style={[styles.label, { color, fontWeight: active ? '700' : '600' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{TAB_LABEL[k]}</Text>
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
  // absolut + Seitenabstand -> schwebt frei; borderRadius 30 auf Hoehe 60 = Pillenform
  bar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', height: 60, borderRadius: 30, borderWidth: 1, overflow: 'hidden' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 4 },
  label: { fontSize: 11, letterSpacing: 0.1 },
});
