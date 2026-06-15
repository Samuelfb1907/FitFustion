// Untere Tab-Leiste: SCHWEBENDE Glas-Pille. Sie ist ABSOLUT positioniert und liegt FREI ueber
// dem Inhalt (kein eigener Hintergrund-Streifen, keine reservierte Flaeche) - der Inhalt laeuft
// bis ganz unten durch und scrollt hinter der Pille durch. Damit nichts verdeckt wird, lassen die
// Seiten unten TAB_BAR_SPACE Platz (siehe lib/layout). Pille = abgerundet + durchscheinend
// (BlurView) + zarte Lichtkante. Aktiver Reiter GRUEN, Rest grau. Wechsel NUR per Tippen.
import { useState, ReactNode } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { useAndroidBack } from '../lib/useBackHandler';

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

  // Android-System-Zurueck als unterste Ebene (wird zuerst registriert -> kommt zuletzt
  // dran). Jeder Tab faengt sein eigenes Zurueck ab, solange er einen Unterscreen offen
  // hat; ist er auf seiner Startebene, landen wir hier: nicht-Start-Tab -> zum Start-Tab,
  // auf "Start" geben wir false zurueck -> die App schliesst sich (Android-Standard).
  useAndroidBack(() => {
    if (tab !== 'home') { go('home'); return true; }
    return false;
  });

  // Glas-Toenung: in Dunkel ein zarter heller Schimmer (Glas faengt Licht); in Hell frostig hell.
  const glassTint = dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.45)';
  // Android: expo-blur rendert die Pille oft komplett durchsichtig. Daher dort KEIN BlurView,
  // sondern ein solider (fast deckender) Hintergrund + dezente Elevation; iOS behaelt das Glas.
  const isAndroid = Platform.OS === 'android';
  const androidBarBg = dark ? 'rgba(18,24,30,0.96)' : 'rgba(255,255,255,0.96)';

  // Tab-Buttons - in beiden Varianten (iOS-Pille / Android-Leiste) identisch.
  const tabs = TAB_ORDER.map((k) => {
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
  });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Ambient c={c} />
      <View style={{ flex: 1 }}>
        {mounted.home && <Page active={tab === 'home'}><HomeScreen onNavigate={(tb, seg) => go(tb as Tab, seg as EssenSeg | undefined)} focusTick={ticks.home} /></Page>}
        {mounted.training && <Page active={tab === 'training'}><TrainingScreen focusTick={ticks.training} focused={tab === 'training'} /></Page>}
        {mounted.essen && <Page active={tab === 'essen'}><EssenScreen focusTick={ticks.essen} initialSeg={essenSeg} focused={tab === 'essen'} /></Page>}
        {mounted.progress && <Page active={tab === 'progress'}><ProgressScreen focusTick={ticks.progress} focused={tab === 'progress'} /></Page>}
        {mounted.settings && <Page active={tab === 'settings'}><SettingsScreen focusTick={ticks.settings} focused={tab === 'settings'} /></Page>}
      </View>
      {/* Tab-Leiste: iOS = schwebende Glas-Pille; Android = durchgehende, DECKENDE Leiste am
          unteren Rand (deckt den Inhalt ab -> kein Durchscheinen wie beim Blur auf Android). */}
      {isAndroid ? (
        <View style={[styles.barAndroid, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: androidBarBg, borderTopColor: c.hairline }]}>
          {tabs}
        </View>
      ) : (
        <View style={[styles.bar, { bottom: Math.max(insets.bottom, 12), borderColor: c.hairline }]}>
          <BlurView intensity={dark ? 32 : 52} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: glassTint }]} />
          {tabs}
        </View>
      )}
      <StepsPrompt />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  pageHidden: { flex: 1, display: 'none' },
  // absolut + Seitenabstand -> schwebt frei; borderRadius 30 auf Hoehe 60 = Pillenform
  bar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', height: 60, borderRadius: 30, borderWidth: 1, overflow: 'hidden' },
  // Android: durchgehende, deckende Leiste am unteren Rand (full-width), abgerundete Oberkante, flach.
  barAndroid: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', paddingTop: 8, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 4 },
  label: { fontSize: 11, letterSpacing: 0.1 },
});
