// Untere Tab-Leiste: SCHWEBENDE Glas-Pille. Sie ist ABSOLUT positioniert und liegt FREI ueber
// dem Inhalt (kein eigener Hintergrund-Streifen, keine reservierte Flaeche) - der Inhalt laeuft
// bis ganz unten durch und scrollt hinter der Pille durch. Damit nichts verdeckt wird, lassen die
// Seiten unten TAB_BAR_SPACE Platz (siehe lib/layout). Pille = abgerundet + durchscheinend
// (BlurView) + zarte Lichtkante. Aktiver Reiter GRUEN, Rest grau. Wechsel NUR per Tippen.
import { useState, useEffect, ReactNode } from 'react';
import { AppState, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import LobbyScreen from './LobbyScreen';
import Ambient from '../components/Ambient';
import StepsPrompt from '../components/StepsPrompt';
import { useAndroidBack } from '../lib/useBackHandler';
import { useAuth } from '../contexts/AuthContext';
import { usePaywall } from '../components/Paywall';
import CoachChat from '../components/CoachChat';
import { fetchUnreadSocialCount } from '../lib/activity';

type Tab = 'home' | 'training' | 'essen' | 'progress' | 'lobby' | 'settings';
const TAB_ORDER: Tab[] = ['home', 'training', 'essen', 'progress', 'lobby', 'settings'];
const TAB_ICON: Record<Tab, string> = { home: 'home', training: 'barbell', essen: 'restaurant', progress: 'stats-chart', lobby: 'people', settings: 'settings' };

function Page({ active, children }: { active: boolean; children: ReactNode }) {
  return <View style={active ? styles.page : styles.pageHidden}>{children}</View>;
}

export default function MainTabs() {
  const [tab, setTab] = useState<Tab>('home');
  const [mounted, setMounted] = useState<Record<Tab, boolean>>({ home: true, training: false, essen: false, progress: false, lobby: false, settings: false });
  const [ticks, setTicks] = useState<Record<Tab, number>>({ home: 0, training: 0, essen: 0, progress: 0, lobby: 0, settings: 0 });
  const [essenSeg, setEssenSeg] = useState<EssenSeg>('tracker'); // welcher Unter-Reiter im Essen-Hub geoeffnet wird
  const [progressSeg, setProgressSeg] = useState<'me' | 'board'>('me'); // welcher Unter-Reiter im Fortschritt-Tab geoeffnet wird (Sprung auf Bestenliste)
  const c = useColors();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const t = useT();
  const insets = useSafeAreaInsets();
  const { isPremium } = useAuth();
  const { openPaywall } = usePaywall();
  const [showCoach, setShowCoach] = useState(false);
  const [lobbyDot, setLobbyDot] = useState(false); // roter Punkt am Lobby-Tab: neue Reaktionen bei mir

  // Punkt aktualisieren: beim Start + jedes Mal, wenn die App in den Vordergrund kommt.
  useEffect(() => {
    const refresh = () => { fetchUnreadSocialCount().then((n) => setLobbyDot(n > 0)).catch(() => {}); };
    refresh();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => sub.remove();
  }, []);

  const TAB_LABEL: Record<Tab, string> = {
    home: t('tabs.start'), training: t('tabs.training'), essen: t('tabs.food'), progress: t('tabs.progress'), lobby: t('tabs.lobby'), settings: t('tabs.settings'),
  };

  const go = (target: Tab, seg?: string) => {
    setMounted((m) => (m[target] ? m : { ...m, [target]: true }));
    if (target === 'essen') setEssenSeg((seg as EssenSeg) ?? 'tracker');
    if (target === 'progress') setProgressSeg(seg === 'board' ? 'board' : 'me');
    setTicks((k) => ({ ...k, [target]: k[target] + 1 }));
    const leavingLobby = tab === 'lobby' && target !== 'lobby';
    setTab(target);
    // Lobby oeffnen -> Punkt weg (wird dort als gesehen markiert). Lobby verlassen -> neu pruefen.
    if (target === 'lobby') setLobbyDot(false);
    else if (leavingLobby) fetchUnreadSocialCount().then((n) => setLobbyDot(n > 0)).catch(() => {});
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
        <View>
          <Ionicons name={(active ? TAB_ICON[k] : `${TAB_ICON[k]}-outline`) as any} size={23} color={color} />
          {k === 'lobby' && lobbyDot && <View style={[styles.tabDot, { borderColor: c.bg }]} />}
        </View>
        <Text style={[styles.label, { color, fontWeight: active ? '700' : '600' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{TAB_LABEL[k]}</Text>
      </TouchableOpacity>
    );
  });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Ambient c={c} />
      <View style={{ flex: 1 }}>
        {mounted.home && <Page active={tab === 'home'}><HomeScreen onNavigate={(tb, seg) => go(tb as Tab, seg)} focusTick={ticks.home} /></Page>}
        {mounted.training && <Page active={tab === 'training'}><TrainingScreen focusTick={ticks.training} focused={tab === 'training'} /></Page>}
        {mounted.essen && <Page active={tab === 'essen'}><EssenScreen focusTick={ticks.essen} initialSeg={essenSeg} focused={tab === 'essen'} /></Page>}
        {mounted.progress && <Page active={tab === 'progress'}><ProgressScreen focusTick={ticks.progress} focused={tab === 'progress'} initialSeg={progressSeg} /></Page>}
        {mounted.lobby && <Page active={tab === 'lobby'}><LobbyScreen focusTick={ticks.lobby} focused={tab === 'lobby'} /></Page>}
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
      {/* Schwebender KI-Coach-Knopf. Auf dem Lobby-Tab ausgeblendet, weil er dort die
          Kudos-/Kommentar-Knoepfe im Freunde-Feed verdecken wuerde. */}
      {tab !== 'lobby' && (
        <TouchableOpacity
          style={[styles.fab, { bottom: isAndroid ? Math.max(insets.bottom, 8) + 64 : Math.max(insets.bottom, 12) + 76, backgroundColor: c.primary }]}
          onPress={() => { if (!isPremium) openPaywall('ki'); else setShowCoach(true); }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('coach.title')}
        >
          <Ionicons name="chatbubble-ellipses" size={24} color={c.onPrimary} />
        </TouchableOpacity>
      )}

      <Modal visible={showCoach} animationType="slide" onRequestClose={() => setShowCoach(false)} presentationStyle="fullScreen">
        <CoachChat onClose={() => setShowCoach(false)} />
      </Modal>

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
  tabDot: { position: 'absolute', top: -3, right: -6, width: 10, height: 10, borderRadius: 5, backgroundColor: '#F0574B', borderWidth: 1.5 },
  fab: { position: 'absolute', right: 18, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  label: { fontSize: 11, letterSpacing: 0.1 },
});
