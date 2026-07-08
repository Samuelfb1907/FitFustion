// Untere Navigation im LIFESUM-Stil: vier Reiter (Start · Training · Essen · Lobby) und in
// der MITTE ein grosses, erhabenes gruenes "+" das ein Schnell-Menue oeffnet
// (Gewicht · Wasser · Essen · Training). Fortschritt & Einstellungen sind KEINE Reiter mehr,
// sondern ueber die Icons oben rechts auf der Startseite erreichbar (bleiben aber gemountet).
// Die Reiter-Pille schwebt frei (iOS = Glas/BlurView, Android = deckende Leiste). Das "+" wird
// SEPARAT und absolut positioniert (nicht in der Pille), damit es ueber deren Rand ragen darf.
import { useState, useEffect, useRef, ReactNode } from 'react';
import { AppState, Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { supabase } from '../lib/supabase';
import { todayStr } from '../lib/date';
import { hTap, hSuccess } from '../lib/haptics';

type Tab = 'home' | 'training' | 'essen' | 'progress' | 'lobby' | 'settings';
// Nur diese vier erscheinen in der Leiste (2 links, dann "+", dann 2 rechts).
const LEFT_TABS: Tab[] = ['home', 'training'];
const RIGHT_TABS: Tab[] = ['essen', 'lobby'];
const TAB_ICON: Record<Tab, string> = { home: 'home', training: 'barbell', essen: 'restaurant', progress: 'stats-chart', lobby: 'people', settings: 'settings' };

function Page({ active, children }: { active: boolean; children: ReactNode }) {
  return <View style={active ? styles.page : styles.pageHidden}>{children}</View>;
}

export default function MainTabs() {
  const [tab, setTab] = useState<Tab>('home');
  const [mounted, setMounted] = useState<Record<Tab, boolean>>({ home: true, training: false, essen: false, progress: false, lobby: false, settings: false });
  const [ticks, setTicks] = useState<Record<Tab, number>>({ home: 0, training: 0, essen: 0, progress: 0, lobby: 0, settings: 0 });
  const [essenSeg, setEssenSeg] = useState<EssenSeg>('tracker'); // welcher Unter-Reiter im Essen-Hub geoeffnet wird
  const [progressSeg, setProgressSeg] = useState<'me' | 'board'>('me'); // Sprung auf Bestenliste
  const [trainingSeg, setTrainingSeg] = useState<'free' | 'plan' | 'cardio'>('free'); // "+"-Menue springt auf "cardio" (Aktivitaet)
  const c = useColors();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const t = useT();
  const insets = useSafeAreaInsets();
  const { isPremium, session } = useAuth();
  const { openPaywall } = usePaywall();
  const [showCoach, setShowCoach] = useState(false);
  const [lobbyDot, setLobbyDot] = useState(false); // roter Punkt am Lobby-Tab: neue Reaktionen bei mir
  const [quickOpen, setQuickOpen] = useState(false); // Schnell-Menue (zentrales "+")
  const [toast, setToast] = useState<string | null>(null); // kurze Bestaetigung (z. B. Wasser eingetragen)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Punkt aktualisieren: beim Start + jedes Mal, wenn die App in den Vordergrund kommt.
  useEffect(() => {
    const refresh = () => { fetchUnreadSocialCount().then((n) => setLobbyDot(n > 0)).catch(() => {}); };
    refresh();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => sub.remove();
  }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1900);
  }

  const TAB_LABEL: Record<Tab, string> = {
    home: t('tabs.start'), training: t('tabs.training'), essen: t('tabs.food'), progress: t('tabs.progress'), lobby: t('tabs.lobby'), settings: t('tabs.settings'),
  };

  const go = (target: Tab, seg?: string) => {
    setMounted((m) => (m[target] ? m : { ...m, [target]: true }));
    if (target === 'essen') setEssenSeg((seg as EssenSeg) ?? 'tracker');
    if (target === 'progress') setProgressSeg(seg === 'board' ? 'board' : 'me');
    if (target === 'training') setTrainingSeg(seg === 'cardio' || seg === 'plan' ? (seg as 'cardio' | 'plan') : 'free');
    setTicks((k) => ({ ...k, [target]: k[target] + 1 }));
    const leavingLobby = tab === 'lobby' && target !== 'lobby';
    setTab(target);
    // Lobby oeffnen -> Punkt weg (wird dort als gesehen markiert). Lobby verlassen -> neu pruefen.
    if (target === 'lobby') setLobbyDot(false);
    else if (leavingLobby) fetchUnreadSocialCount().then((n) => setLobbyDot(n > 0)).catch(() => {});
  };

  // Wasser direkt aus dem "+"-Menue eintragen (0,25 L) – ohne Umweg ueber die Startseite.
  const quickWater = async () => {
    setQuickOpen(false);
    const uid = session?.user?.id;
    if (!uid) return;
    const { error } = await supabase.from('water_logs').insert({ user_id: uid, amount_ml: 250, log_date: todayStr() });
    if (!error) { hSuccess(); showToast(t('home.waterAdded')); }
  };

  // Schnell-Aktionen im "+"-Menue. Jede Kachel macht genau EINE schnelle Sache.
  const quickActions: { key: string; icon: string; color: string; tint: string; onPress: () => void }[] = [
    { key: 'weight', icon: 'scale-outline', color: dark ? '#C3A8FF' : '#7C5CD6', tint: 'rgba(157,123,244,0.14)', onPress: () => { hTap(); setQuickOpen(false); go('progress'); } },
    { key: 'water', icon: 'water', color: '#3FA9F5', tint: 'rgba(63,169,245,0.14)', onPress: () => { quickWater(); } },
    { key: 'food', icon: 'restaurant', color: '#E69500', tint: 'rgba(230,149,0,0.14)', onPress: () => { hTap(); setQuickOpen(false); go('essen', 'tracker'); } },
    { key: 'training', icon: 'barbell', color: c.primary, tint: 'rgba(25,201,143,0.14)', onPress: () => { hTap(); setQuickOpen(false); go('training', 'cardio'); } },
  ];

  // Android-System-Zurueck als unterste Ebene. Nicht-Start-Tab -> zum Start; auf "Start"
  // false -> die App schliesst sich. Ein offenes Schnell-Menue zuerst schliessen.
  useAndroidBack(() => {
    if (quickOpen) { setQuickOpen(false); return true; }
    if (tab !== 'home') { go('home'); return true; }
    return false;
  });

  // Glas-Toenung: in Dunkel ein zarter heller Schimmer; in Hell frostig hell.
  const glassTint = dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.45)';
  // Android: expo-blur rendert die Pille oft komplett durchsichtig. Daher dort KEIN BlurView,
  // sondern ein solider (fast deckender) Hintergrund + dezente Elevation; iOS behaelt das Glas.
  const isAndroid = Platform.OS === 'android';
  const androidBarBg = dark ? 'rgba(18,24,30,0.96)' : 'rgba(255,255,255,0.96)';

  // Position des erhabenen "+" (mittig, ragt ueber die Leiste). Werte je Plattform abgestimmt.
  const plusBottom = isAndroid ? Math.max(insets.bottom, 8) + 16 : Math.max(insets.bottom, 12) + 26;

  const renderTab = (k: Tab) => {
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
  };

  // Inhalt der Leiste: 2 Reiter, freier Mittelplatz (dort schwebt das "+"), 2 Reiter.
  const barContent = (
    <>
      {LEFT_TABS.map(renderTab)}
      <View style={styles.plusSlot} />
      {RIGHT_TABS.map(renderTab)}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Ambient c={c} />
      <View style={{ flex: 1 }}>
        {mounted.home && <Page active={tab === 'home'}><HomeScreen onNavigate={(tb, seg) => go(tb as Tab, seg)} focusTick={ticks.home} /></Page>}
        {mounted.training && <Page active={tab === 'training'}><TrainingScreen focusTick={ticks.training} focused={tab === 'training'} initialSeg={trainingSeg} /></Page>}
        {mounted.essen && <Page active={tab === 'essen'}><EssenScreen focusTick={ticks.essen} initialSeg={essenSeg} focused={tab === 'essen'} /></Page>}
        {mounted.progress && <Page active={tab === 'progress'}><ProgressScreen focusTick={ticks.progress} focused={tab === 'progress'} initialSeg={progressSeg} /></Page>}
        {mounted.lobby && <Page active={tab === 'lobby'}><LobbyScreen focusTick={ticks.lobby} focused={tab === 'lobby'} /></Page>}
        {mounted.settings && <Page active={tab === 'settings'}><SettingsScreen focusTick={ticks.settings} focused={tab === 'settings'} /></Page>}
      </View>

      {/* Reiter-Leiste: iOS = schwebende Glas-Pille; Android = durchgehende, deckende Leiste. */}
      {isAndroid ? (
        <View style={[styles.barAndroid, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: androidBarBg, borderTopColor: c.hairline }]}>
          {barContent}
        </View>
      ) : (
        <View style={[styles.bar, { bottom: Math.max(insets.bottom, 12), borderColor: c.hairline }]}>
          <BlurView intensity={dark ? 32 : 52} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: glassTint }]} />
          {barContent}
        </View>
      )}

      {/* Erhabenes zentrales "+" – separat & absolut, damit es ueber die Pille ragen darf.
          box-none: nur der Knopf selbst faengt Beruehrungen, der Rest bleibt durchlaessig. */}
      <View pointerEvents="box-none" style={[styles.plusWrap, { bottom: plusBottom }]}>
        <TouchableOpacity
          style={[styles.plusBtn, { backgroundColor: c.primary, borderColor: c.bg }]}
          onPress={() => { hTap(); setQuickOpen(true); }}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={t('quick.a11y')}
        >
          <Ionicons name="add" size={32} color={c.onPrimary} />
        </TouchableOpacity>
      </View>

      {/* Kurze Bestaetigung (Wasser eingetragen o. ae.) – schwebt ueber der Leiste. */}
      {toast && (
        <View pointerEvents="none" style={[styles.toast, { bottom: plusBottom + 70, backgroundColor: c.card, borderColor: c.cardBorder }]}>
          <Ionicons name="checkmark-circle" size={16} color={c.primary} />
          <Text style={[styles.toastText, { color: c.text }]} numberOfLines={1}>{toast}</Text>
        </View>
      )}

      {/* Schwebender KI-Coach-Knopf. Auf dem Lobby-Tab ausgeblendet (verdeckt dort Feed-Knoepfe). */}
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

      {/* Zentrales "+"-Schnellmenue: getipptes Backdrop schliesst; die Blase liegt unten. */}
      <Modal visible={quickOpen} transparent animationType="slide" onRequestClose={() => setQuickOpen(false)}>
        <View style={styles.quickWrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setQuickOpen(false)} accessibilityRole="button" accessibilityLabel={t('quick.close')} />
          <View style={[styles.quickSheet, { backgroundColor: c.bg, borderTopColor: c.hairline, paddingBottom: Math.max(insets.bottom, 16) + 10 }]}>
            <View style={[styles.quickHandle, { backgroundColor: c.hairline }]} />
            <Text style={[styles.quickTitle, { color: c.textMuted }]}>{t('quick.title')}</Text>
            <View style={styles.quickRow}>
              {quickActions.map((a) => (
                <TouchableOpacity key={a.key} style={styles.quickTile} onPress={a.onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t(`quick.${a.key}`)}>
                  <View style={[styles.quickTileIcon, { backgroundColor: a.tint }]}>
                    <Ionicons name={a.icon as any} size={26} color={a.color} />
                  </View>
                  <Text style={[styles.quickTileLabel, { color: c.text }]} numberOfLines={1}>{t(`quick.${a.key}`)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

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
  // Freier Mittelplatz in der Leiste (dort schwebt das "+").
  plusSlot: { flex: 1 },
  // Wrapper fuer das "+": ueber die gesamte Breite, mittig zentriert.
  plusWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  plusBtn: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', borderWidth: 4, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 10 },
  fab: { position: 'absolute', right: 18, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  label: { fontSize: 11, letterSpacing: 0.1 },

  // Schnell-Menue
  quickWrap: { flex: 1, justifyContent: 'flex-end' },
  quickSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  quickHandle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 16 },
  quickTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', textAlign: 'center', marginBottom: 20 },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quickTile: { flex: 1, alignItems: 'center' },
  quickTileIcon: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  quickTileLabel: { fontSize: 13, fontWeight: '600' },

  // Toast
  toast: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  toastText: { fontSize: 14, fontWeight: '700' },
});
