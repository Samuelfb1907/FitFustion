// Schritte-Lobby (#48b): Gruppen-Tab. Erstelle/tritt einer Lobby bei, lade Freunde per
// Link/Code ein und duelliert euch taeglich in Schritten (meiste oben). Schritte kommen
// vom Geraet (lib/health); in Expo Go stabile Beispielwerte (s. lib/lobby.syncTodaySteps).
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import GlassFill from '../components/GlassFill';
import Segmented from '../components/Segmented';
import FriendsPanel from '../components/FriendsPanel';
import LeaguePanel from '../components/LeaguePanel';
import SectionHead from '../components/SectionHead';
import ErrorRetry from '../components/ErrorRetry';
import { errorMessage } from '../lib/errors';
import { CARD_SHADOW as shadow } from '../lib/ui';
import { TAB_BAR_SPACE } from '../lib/layout';
import { Ionicons } from '@expo/vector-icons';
import { healthSupported } from '../lib/health';
import { Lobby, LobbyRow, LobbyWeekRow, HallEntry, fetchMyLobbies, fetchLobbyBoard, fetchLobbyWeekBoard, fetchLobbyHallOfFame, createLobby, joinLobby, leaveLobby, lobbyInviteLink, syncTodaySteps } from '../lib/lobby';
import { fetchUnreadSocialCount } from '../lib/activity';

const MEDAL_COLORS = ['#F0B429', '#C0C7CF', '#CD7F32']; // Gold, Silber, Bronze
const NAME_KEY = 'fitavo.lobbyName';

// Tausender-Punkt ohne Intl-Abhaengigkeit (Hermes): 8432 -> "8.432".
function formatSteps(n: number): string {
  return String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Wochen-Key (Montag "YYYY-MM-DD") -> "DD.MM." fuer die Ruhmeshalle.
function formatWeek(key: string): string {
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.` : key;
}

export default function LobbyScreen({ focusTick }: { focusTick?: number; focused?: boolean }) {
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [board, setBoard] = useState<LobbyRow[]>([]);
  const [weekBoard, setWeekBoard] = useState<LobbyWeekRow[]>([]);
  const [hall, setHall] = useState<HallEntry[]>([]);
  const [period, setPeriod] = useState<'today' | 'week'>('today');
  const [myName, setMyName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [showForms, setShowForms] = useState(false);
  const [view, setView] = useState<'liga' | 'lobby' | 'friends'>('liga'); // Reiter: Liga, Schritte-Lobby oder Freunde
  const [friendsDot, setFriendsDot] = useState(false); // roter Punkt am Freunde-Reiter: neue Reaktionen bei mir

  useEffect(() => { init(); }, []);
  // Tab-Fokus: Schritte hochladen + Rangliste auffrischen (focusTick steigt bei jedem Tippen).
  useEffect(() => { if (focusTick) reload(); }, [focusTick]);
  // Punkt am Freunde-Reiter: zeigen, wenn neue Reaktionen offen sind - ausser man schaut gerade hin.
  useEffect(() => {
    if (view === 'friends') { setFriendsDot(false); return; }
    fetchUnreadSocialCount().then((n) => setFriendsDot(n > 0)).catch(() => {});
  }, [focusTick, view]);

  async function load(silent: boolean) {
    if (!silent) setLoading(true);
    try {
      await syncTodaySteps();
      const ls = await fetchMyLobbies();
      setLobbies(ls);
      const active = activeId && ls.some((l) => l.id === activeId) ? activeId : (ls[0]?.id ?? null);
      setActiveId(active);
      if (active) {
        const [b, wb, h] = await Promise.all([
          fetchLobbyBoard(active),
          fetchLobbyWeekBoard(active).catch(() => [] as LobbyWeekRow[]),
          fetchLobbyHallOfFame(active).catch(() => [] as HallEntry[]),
        ]);
        setBoard(b); setWeekBoard(wb); setHall(h);
      } else {
        setBoard([]); setWeekBoard([]); setHall([]);
      }
      setErr(null);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function init() {
    try { const stored = await AsyncStorage.getItem(NAME_KEY); if (stored) setMyName(stored); } catch {}
    await load(false);
  }
  // Auffrischen OHNE Vollbild-Ladezustand (sonst flackert kurz der leere Hintergrund - "Blackscreen").
  // load() laeuft hier immer silent; withSpinner zeigt zusaetzlich den Pull-to-Refresh-Spinner.
  function reload(withSpinner = false) { if (withSpinner) setRefreshing(true); load(true); }

  async function selectLobby(id: string) {
    setActiveId(id);
    setBusy(true);
    try {
      const [b, wb, h] = await Promise.all([
        fetchLobbyBoard(id),
        fetchLobbyWeekBoard(id).catch(() => [] as LobbyWeekRow[]),
        fetchLobbyHallOfFame(id).catch(() => [] as HallEntry[]),
      ]);
      setBoard(b); setWeekBoard(wb); setHall(h);
    } catch (e) { setErr(errorMessage(e)); }
    setBusy(false);
  }

  async function persistName(n: string) { try { await AsyncStorage.setItem(NAME_KEY, n); } catch {} }

  async function doCreate() {
    const name = nameInput.trim();
    if (!name) { Alert.alert(t('lobby.nameRequired')); return; }
    setBusy(true);
    try {
      const lobby = await createLobby(name, myName.trim());
      await persistName(myName.trim());
      setNameInput(''); setShowForms(false);
      if (lobby) setActiveId(lobby.id);
      await load(true);
      Alert.alert(t('lobby.created'));
    } catch (e) { setErr(errorMessage(e)); }
    setBusy(false);
  }

  async function doJoin() {
    const code = codeInput.trim();
    if (!code) return;
    setBusy(true);
    try {
      const id = await joinLobby(code, myName.trim());
      if (!id) { Alert.alert(t('lobby.joinFailed')); setBusy(false); return; }
      await persistName(myName.trim());
      setCodeInput(''); setShowForms(false);
      setActiveId(id);
      await load(true);
      Alert.alert(t('lobby.joined'));
    } catch (e) { setErr(errorMessage(e)); }
    setBusy(false);
  }

  const activeLobby = lobbies.find((l) => l.id === activeId) || null;

  async function invite() {
    if (!activeLobby) return;
    const link = lobbyInviteLink(activeLobby.invite_code);
    const message = t('lobby.inviteMsg', { name: activeLobby.name, code: activeLobby.invite_code, link });
    try {
      await Share.share(Platform.OS === 'ios' ? { message, url: link } : { message }, { dialogTitle: t('lobby.invite') });
    } catch {}
  }

  function confirmLeave() {
    if (!activeLobby) return;
    Alert.alert(t('lobby.leave.confirmTitle'), t('lobby.leave.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('lobby.leave.confirm'), style: 'destructive', onPress: doLeave },
    ]);
  }
  async function doLeave() {
    if (!activeLobby) return;
    setBusy(true);
    try { await leaveLobby(activeLobby.id); setActiveId(null); await load(true); }
    catch (e) { setErr(errorMessage(e)); }
    setBusy(false);
  }

  // Anzeige-Zeilen je nach Zeitraum (heute = board, Woche = weekBoard) auf ein gemeinsames Format.
  const displayRows = period === 'week'
    ? weekBoard.map((r) => ({ name: r.display_name, steps: r.steps, is_me: r.is_me }))
    : board.map((r) => ({ name: r.display_name, steps: r.steps_today, is_me: r.is_me }));
  const myRank = displayRows.findIndex((r) => r.is_me) + 1; // 0 = nicht in der Liste

  // Lobby-Inhalt (Schritte-Reiter) mit eigenen Lade-/Fehlerzustaenden. Der Freunde-Reiter
  // (FriendsPanel) ist unabhaengig und bleibt erreichbar, auch wenn die Lobby gerade laedt.
  function renderLobby() {
    if (loading) return <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} />;
    if (err && lobbies.length === 0) return <ErrorRetry message={err} onRetry={() => load(false)} />;
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={c.primary} colors={[c.primary]} />}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.tagline}>{t('lobby.tagline')}</Text>
      {!healthSupported() && <Text style={styles.testNote}>{t('lobby.testMode')}</Text>}

      {lobbies.length === 0 ? (
        renderForms(true)
      ) : (
        <>
          {lobbies.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
              {lobbies.map((l) => {
                const on = l.id === activeId;
                return (
                  <TouchableOpacity key={l.id} onPress={() => selectLobby(l.id)} style={[styles.switchPill, on && styles.switchPillOn]} activeOpacity={0.85}>
                    <Text style={[styles.switchText, on && styles.switchTextOn]} numberOfLines={1}>{l.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {activeLobby && (
            <View style={styles.headerTile}>
              <GlassFill radius={20} />
              <View style={styles.lobbyIcon}><Ionicons name="people" size={20} color={c.primary} /></View>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.lobbyName} numberOfLines={1}>{activeLobby.name}</Text>
                <Text style={styles.lobbyCode}>{t('lobby.code', { code: activeLobby.invite_code })}</Text>
              </View>
              <TouchableOpacity style={styles.inviteBtn} onPress={invite} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('lobby.invite')}>
                <Ionicons name="person-add" size={16} color={c.onPrimary} />
                <Text style={styles.inviteText}>{t('lobby.invite')}</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ marginTop: 12 }}>
            <Segmented
              options={[{ key: 'today', label: t('lobby.period.today') }, { key: 'week', label: t('lobby.period.week') }]}
              value={period}
              onChange={(k) => setPeriod(k as 'today' | 'week')}
              c={c}
            />
          </View>

          <View style={styles.tile}>
            <GlassFill radius={20} />
            <View style={styles.boardHead}>
              <View style={{ flex: 1 }}>
                <SectionHead icon={period === 'week' ? 'calendar' : 'footsteps'} title={period === 'week' ? t('lobby.board.labelWeek') : t('lobby.board.label')} />
              </View>
              {myRank > 0 && <Text style={styles.myRank}>{t('lobby.myRank', { rank: myRank, total: displayRows.length })}</Text>}
            </View>
            {displayRows.length === 0 ? (
              <Text style={styles.empty}>{t('lobby.board.empty')}</Text>
            ) : (
              displayRows.map((r, i) => (
                <View key={i} style={[styles.rankRow, i > 0 && styles.rankDivider, r.is_me && styles.rankRowMe]}>
                  {i < 3 ? (
                    <View style={styles.rankPosBox}><Ionicons name="medal" size={22} color={MEDAL_COLORS[i]} /></View>
                  ) : (
                    <Text style={styles.rankPos}>#{i + 1}</Text>
                  )}
                  <Text style={[styles.rankName, r.is_me && styles.rankNameMe]} numberOfLines={1}>{r.name}{r.is_me ? t('lobby.you') : ''}</Text>
                  <Text style={styles.rankScore} numberOfLines={1}>{formatSteps(r.steps)}</Text>
                </View>
              ))
            )}
          </View>

          {hall.length > 0 && (
            <View style={styles.tile}>
              <GlassFill radius={20} />
              <SectionHead icon="trophy" title={t('lobby.hall.label')} tint="#F0B429" />
              {hall.map((w, i) => (
                <View key={i} style={[styles.rankRow, i > 0 && styles.rankDivider]}>
                  <Ionicons name="trophy" size={18} color="#F0B429" style={{ width: 30 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hallName} numberOfLines={1}>{w.display_name}</Text>
                    <Text style={styles.hallWeek}>{t('lobby.hall.week', { date: formatWeek(w.week_key) })}</Text>
                  </View>
                  <Text style={styles.rankScore} numberOfLines={1}>{formatSteps(w.steps)}</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowForms((s) => !s)} activeOpacity={0.85}>
            <Ionicons name={showForms ? 'chevron-up' : 'add'} size={18} color={c.primary} />
            <Text style={styles.secondaryText}>{t('lobby.addMore')}</Text>
          </TouchableOpacity>
          {showForms && renderForms()}

          <TouchableOpacity style={styles.leaveBtn} onPress={confirmLeave} disabled={busy} activeOpacity={0.85}>
            <Text style={styles.leaveText}>{t('lobby.leave')}</Text>
          </TouchableOpacity>
        </>
      )}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('lobby.hubTitle')}</Text>
      <Segmented
        options={[{ key: 'liga', label: t('league.tab') }, { key: 'lobby', label: t('lobby.segLobby') }, { key: 'friends', label: t('lobby.segFriends'), dot: friendsDot }]}
        value={view}
        onChange={(k) => { setView(k as 'liga' | 'lobby' | 'friends'); if (k === 'friends') setFriendsDot(false); }}
        c={c}
      />
      <View style={{ height: 10 }} />
      {view === 'liga' ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
          <LeaguePanel focusTick={focusTick} />
        </ScrollView>
      ) : view === 'friends' ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
          <FriendsPanel focusTick={focusTick} />
        </ScrollView>
      ) : (
        renderLobby()
      )}
    </View>
  );

  // Erstellen-/Beitreten-Formular (im Leerzustand prominent, sonst aufklappbar).
  // ALS FUNKTION inline gerendert (nicht als <Forms/>-Komponente) - sonst remountet RN das
  // Formular bei jedem Tastendruck und die Eingabe verliert den Fokus.
  function renderForms(empty?: boolean) {
    return (
      <View>
        {empty && (
          <View style={styles.emptyTile}>
            <GlassFill radius={20} />
            <Text style={styles.emptyIcon}>🚶</Text>
            <Text style={styles.emptyTitle}>{t('lobby.empty.title')}</Text>
            <Text style={styles.emptyBody}>{t('lobby.empty.body')}</Text>
          </View>
        )}
        <View style={styles.tile}>
          <GlassFill radius={20} />
          <Text style={styles.label}>{t('lobby.yourName')}</Text>
          <TextInput style={styles.input} value={myName} onChangeText={setMyName} placeholder={t('lobby.yourNamePlaceholder')} placeholderTextColor={c.textMuted} maxLength={24} autoCapitalize="words" underlineColorAndroid="transparent" />

          <Text style={[styles.label, { marginTop: 16 }]}>{t('lobby.create.heading')}</Text>
          <TextInput style={styles.input} value={nameInput} onChangeText={setNameInput} placeholder={t('lobby.create.namePlaceholder')} placeholderTextColor={c.textMuted} maxLength={40} underlineColorAndroid="transparent" />
          <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={doCreate} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.primaryText}>{t('lobby.create.cta')}</Text>}
          </TouchableOpacity>

          <View style={styles.orRow}><View style={styles.orLine} /><Text style={styles.orText}>{t('lobby.or')}</Text><View style={styles.orLine} /></View>

          <Text style={styles.label}>{t('lobby.join.heading')}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[styles.input, { flex: 1 }]} value={codeInput} onChangeText={setCodeInput} placeholder={t('lobby.join.codePlaceholder')} placeholderTextColor={c.textMuted} autoCapitalize="characters" autoCorrect={false} maxLength={12} underlineColorAndroid="transparent" />
            <TouchableOpacity style={[styles.joinBtn, busy && { opacity: 0.6 }]} onPress={doJoin} disabled={busy} activeOpacity={0.85}>
              <Text style={styles.primaryText}>{t('lobby.join.cta')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 56, paddingHorizontal: 16 },
    title: { fontSize: 28, fontWeight: '800', color: c.heading, letterSpacing: -0.5 },
    tagline: { fontSize: 14, color: c.textMuted, lineHeight: 20, marginTop: 4 },
    testNote: { fontSize: 12, color: c.textMuted, fontStyle: 'italic', marginTop: 10, lineHeight: 17 },

    tile: { ...shadow, backgroundColor: c.card, borderRadius: 20, padding: 18, marginTop: 12, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    tileLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: c.textMuted },
    boardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    myRank: { fontSize: 12, fontWeight: '700', color: c.primary },
    empty: { fontSize: 14, color: c.textMuted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 10 },

    // Leerzustand
    emptyTile: { ...shadow, backgroundColor: c.card, borderRadius: 20, padding: 22, marginTop: 14, borderWidth: 1, borderColor: c.cardBorder, alignItems: 'center', overflow: 'hidden' },
    emptyIcon: { fontSize: 40, marginBottom: 6 },
    emptyTitle: { fontSize: 20, fontWeight: '800', color: c.heading, textAlign: 'center' },
    emptyBody: { fontSize: 14, color: c.textMuted, lineHeight: 21, textAlign: 'center', marginTop: 8 },

    // Formular
    label: { fontSize: 13, color: c.text, fontWeight: '700', marginBottom: 6 },
    input: { backgroundColor: c.inputBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: c.text, borderWidth: 1, borderColor: c.border },
    primaryBtn: { backgroundColor: c.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
    primaryText: { color: c.onPrimary, fontSize: 16, fontWeight: '800' },
    joinBtn: { backgroundColor: c.primary, borderRadius: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
    orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
    orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.border },
    orText: { fontSize: 12, color: c.textMuted, fontWeight: '700' },

    // Lobby-Kopf
    headerTile: { ...shadow, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderRadius: 20, padding: 16, marginTop: 12, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    lobbyIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(25,201,143,0.16)', alignItems: 'center', justifyContent: 'center' },
    lobbyName: { color: c.heading, fontSize: 17, fontWeight: '800' },
    lobbyCode: { color: c.textMuted, fontSize: 13, fontWeight: '600', marginTop: 2, letterSpacing: 0.5 },
    inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.primary, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
    inviteText: { color: c.onPrimary, fontSize: 14, fontWeight: '800' },

    // Umschalter
    switchPill: { backgroundColor: c.card, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: c.cardBorder, maxWidth: 180 },
    switchPillOn: { backgroundColor: c.primary, borderColor: c.primary },
    switchText: { fontSize: 14, fontWeight: '700', color: c.text },
    switchTextOn: { color: c.onPrimary },

    // Rangliste-Zeilen
    rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    rankDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    rankRowMe: { backgroundColor: c.inputBg, borderRadius: 14, marginHorizontal: -8, paddingHorizontal: 8 },
    rankPos: { width: 40, fontSize: 15, fontWeight: '800', color: c.textMuted },
    rankPosBox: { width: 40, alignItems: 'flex-start' },
    rankName: { flex: 1, fontSize: 15, color: c.text, fontWeight: '600', marginRight: 10 },
    rankNameMe: { color: c.primary, fontWeight: '800' },
    rankScore: { fontSize: 16, fontWeight: '800', color: c.heading },
    hallName: { fontSize: 15, fontWeight: '700', color: c.text },
    hallWeek: { fontSize: 12, color: c.textMuted, marginTop: 1 },

    // Aktionen
    secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, marginTop: 12 },
    secondaryText: { color: c.primary, fontSize: 15, fontWeight: '800' },
    leaveBtn: { borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: c.border, marginTop: 4 },
    leaveText: { color: c.danger, fontSize: 14, fontWeight: '700' },
  });
}
