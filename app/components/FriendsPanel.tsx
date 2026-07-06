// Freunde-Bereich (#48c): kompakter eigener Code, eine vereinte Karte (Hinzufuegen + Anfragen
// + Freundesliste) und eine ruhige Aktivitaets-Karte. Selbst-ladend; Reiter im Lobby-Tab.
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import GlassFill from './GlassFill';
import SectionHead from './SectionHead';
import { CARD_SHADOW as shadow } from '../lib/ui';
import { errorMessage } from '../lib/errors';
import { Friend, FriendRequest, getMyFriendCode, fetchFriends, addFriendByCode, removeFriendByCode, sendNudge, incomingRequests, acceptRequest, declineRequest } from '../lib/friends';
import { FeedItem, fetchFriendsFeed, toggleKudos, SocialNotification, fetchMySocialNotifications, markSocialSeen } from '../lib/activity';
import { hTap } from '../lib/haptics';
import { useAuth } from '../contexts/AuthContext';
import FeedComments from './FeedComments';
import FriendProfile from './FriendProfile';

// Relativer Zeitstempel fuer den Feed: gibt i18n-Key + Zahl zurueck.
function agoKey(iso: string): { key: string; n: number } {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.max(1, Math.floor(diff / 60000));
  if (min < 60) return { key: 'friends.feed.minAgo', n: min };
  const h = Math.floor(min / 60);
  if (h < 24) return { key: 'friends.feed.hAgo', n: h };
  return { key: 'friends.feed.dAgo', n: Math.floor(h / 24) };
}

// Feed-Zeile in Text uebersetzen (auch fuer die Kommentar-Kopfzeile genutzt).
function feedText(item: FeedItem, t: (k: string, p?: Record<string, string | number>) => string): string {
  if (item.type === 'record') return item.detail ? t('friends.feed.recordEx', { name: item.display_name, ex: item.detail }) : t('friends.feed.record', { name: item.display_name });
  if (item.type === 'cardio') return item.detail ? t('friends.feed.cardioEx', { name: item.display_name, ex: item.detail }) : t('friends.feed.cardio', { name: item.display_name });
  return t('friends.feed.trained', { name: item.display_name });
}

// Kopfzeile fuer die Kommentar-Ansicht einer EIGENEN Aktivitaet (aus einer Benachrichtigung).
function notifCtxText(n: SocialNotification, t: (k: string, p?: Record<string, string | number>) => string): string {
  if (n.event_type === 'record') return n.event_detail ? t('friends.notif.ctxRecordEx', { ex: n.event_detail }) : t('friends.notif.ctxRecord');
  if (n.event_type === 'cardio') return n.event_detail ? t('friends.notif.ctxCardioEx', { ex: n.event_detail }) : t('friends.notif.ctxCardio');
  return t('friends.notif.ctxTrained');
}

export default function FriendsPanel({ focusTick }: { focusTick?: number }) {
  const c = useColors();
  const t = useT();
  const { session } = useAuth();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [myCode, setMyCode] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [notifs, setNotifs] = useState<SocialNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<FeedItem | null>(null);
  const [openProfile, setOpenProfile] = useState<Friend | null>(null);
  const [openThread, setOpenThread] = useState<{ eventId: string; headerText: string } | null>(null);

  useEffect(() => { load(); }, []);
  useEffect(() => { if (focusTick) load(); }, [focusTick]);

  async function load() {
    try {
      const [code, list, reqs, fd, nt] = await Promise.all([
        getMyFriendCode(),
        fetchFriends(),
        incomingRequests().catch(() => [] as FriendRequest[]),
        fetchFriendsFeed().catch(() => [] as FeedItem[]),
        fetchMySocialNotifications().catch(() => [] as SocialNotification[]),
      ]);
      setMyCode(code);
      setFriends(list);
      setRequests(reqs);
      setFeed(fd);
      setNotifs(nt);
      setErr(null);
      if (nt.some((n) => n.is_new)) markSocialSeen(); // "Neu"-Markierung bis zum naechsten Laden

    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function share() {
    if (!myCode) return;
    try { await Share.share({ message: t('friends.shareMsg', { code: myCode }) }); } catch {}
  }

  async function add() {
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    setBusy(true);
    try {
      const status = await addFriendByCode(code);
      setBusy(false);
      if (status === 'error') { Alert.alert(t('friends.notFound')); return; }
      setCodeInput('');
      await load();
      if (status === 'already_friends') Alert.alert(t('friends.alreadyFriends'));
      else if (status === 'accepted') Alert.alert(t('friends.addedNow'));
      else Alert.alert(t('friends.requestSent'));
    } catch (e) {
      setBusy(false);
      setErr(errorMessage(e));
    }
  }

  async function nudge(f: Friend) {
    const status = await sendNudge(f.friend_code);
    if (status === 'sent') Alert.alert(t('friends.nudged', { name: f.display_name }));
    else if (status === 'too_soon') Alert.alert(t('friends.nudgeTooSoon', { name: f.display_name }));
  }

  function confirmRemove(f: Friend) {
    Alert.alert(t('friends.removeTitle', { name: f.display_name }), t('friends.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => doRemove(f) },
    ]);
  }
  async function doRemove(f: Friend) {
    setBusy(true);
    try { await removeFriendByCode(f.friend_code); await load(); } catch (e) { setErr(errorMessage(e)); }
    setBusy(false);
  }

  async function accept(r: FriendRequest) {
    setBusy(true);
    try { await acceptRequest(r.friend_code); await load(); } catch (e) { setErr(errorMessage(e)); }
    setBusy(false);
  }
  async function decline(r: FriendRequest) {
    setBusy(true);
    try { await declineRequest(r.friend_code); await load(); } catch (e) { setErr(errorMessage(e)); }
    setBusy(false);
  }

  // Kudos (Feuer) auf eine Freundes-Aktivitaet: optimistisch umschalten, bei Fehler zuruecksetzen.
  async function onKudos(item: FeedItem) {
    hTap();
    setFeed((prev) => prev.map((it) => it.id === item.id
      ? { ...it, i_kudosed: !it.i_kudosed, kudos_count: it.kudos_count + (it.i_kudosed ? -1 : 1) }
      : it));
    const res = await toggleKudos(item.id);
    if (res === null) {
      setFeed((prev) => prev.map((it) => it.id === item.id
        ? { ...it, i_kudosed: item.i_kudosed, kudos_count: item.kudos_count }
        : it));
    }
  }

  if (loading) return <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 30 }} />;

  const initial = (n: string) => (n.charAt(0) || '?').toUpperCase();
  const newCount = notifs.filter((n) => n.is_new).length;

  return (
    <View>
      {err && <Text style={styles.err}>{err}</Text>}

      {/* Aktivitaet bei dir: wer hat auf meine Aktivitaeten reagiert (Kudos/Kommentare) */}
      {notifs.length > 0 && (
        <View style={[styles.card, { marginTop: 14 }]}>
          <GlassFill radius={20} />
          <View style={styles.notifHead}>
            <SectionHead icon="notifications" title={t('friends.notif.title')} />
            {newCount > 0 && <View style={styles.newPill}><Text style={styles.newPillText}>{t('friends.notif.newCount', { n: newCount })}</Text></View>}
          </View>
          {notifs.slice(0, 8).map((n, i) => {
            const isKudos = n.kind === 'kudos';
            const a = agoKey(n.created_at);
            return (
              <TouchableOpacity
                key={`${n.kind}-${n.event_id}-${n.created_at}-${i}`}
                style={[styles.row, i > 0 && styles.rowDivider]}
                activeOpacity={0.7}
                onPress={() => { hTap(); setOpenThread({ eventId: n.event_id, headerText: notifCtxText(n, t) }); }}
                accessibilityRole="button"
              >
                <View style={[styles.feedIcon, { backgroundColor: (isKudos ? '#F0574B' : c.primary) + '22' }]}>
                  <Ionicons name={isKudos ? 'flame' : 'chatbubble'} size={16} color={isKudos ? '#F0574B' : c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.feedText} numberOfLines={2}>
                    {isKudos ? t('friends.notif.kudos', { name: n.actor_name }) : t('friends.notif.comment', { name: n.actor_name })}
                  </Text>
                  {!isKudos && !!n.body && <Text style={styles.notifBody} numberOfLines={2}>«{n.body}»</Text>}
                  <Text style={styles.feedTime}>{t(a.key, { n: a.n })}</Text>
                </View>
                {n.is_new && <View style={styles.newDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Kompakter eigener Code */}
      <View style={styles.codeStrip}>
        <GlassFill radius={20} />
        <View style={{ flex: 1 }}>
          <Text style={styles.codeStripLabel}>{t('friends.yourCode')}</Text>
          <Text style={styles.codeStripCode} selectable numberOfLines={1}>{myCode ?? '–'}</Text>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={share} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('friends.share')}>
          <Ionicons name="share-social" size={16} color={c.onPrimary} />
          <Text style={styles.shareText}>{t('friends.share')}</Text>
        </TouchableOpacity>
      </View>

      {/* Vereinte Freunde-Karte: Hinzufuegen + Anfragen + Liste */}
      <View style={styles.card}>
        <GlassFill radius={20} />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={codeInput}
            onChangeText={setCodeInput}
            placeholder={t('friends.codePlaceholder')}
            placeholderTextColor={c.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            underlineColorAndroid="transparent"
          />
          <TouchableOpacity style={[styles.addBtn, busy && { opacity: 0.6 }]} onPress={add} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.addText}>{t('friends.add')}</Text>}
          </TouchableOpacity>
        </View>

        {requests.length > 0 && (
          <View style={styles.sub}>
            <SectionHead icon="person-add" title={t('friends.requestsLabel', { n: requests.length })} tint="#F0B429" />
            {requests.map((r, i) => (
              <View key={r.friend_code} style={[styles.row, i > 0 && styles.rowDivider]}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{initial(r.display_name)}</Text></View>
                <Text style={styles.name} numberOfLines={1}>{r.display_name}</Text>
                <TouchableOpacity onPress={() => accept(r)} disabled={busy} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('friends.accept')} style={{ marginLeft: 8 }}>
                  <Ionicons name="checkmark-circle" size={28} color={c.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => decline(r)} disabled={busy} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('friends.decline')} style={{ marginLeft: 14 }}>
                  <Ionicons name="close-circle-outline" size={28} color={c.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.sub}>
          <SectionHead icon="people" title={t('friends.listLabel', { n: friends.length })} />
          {friends.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🤝</Text>
              <Text style={styles.empty}>{t('friends.empty')}</Text>
            </View>
          ) : (
            friends.map((f, i) => (
              <View key={f.friend_code} style={[styles.row, i > 0 && styles.rowDivider]}>
                <TouchableOpacity style={styles.friendTap} onPress={() => { hTap(); setOpenProfile(f); }} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={f.display_name}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{initial(f.display_name)}</Text></View>
                  <Text style={styles.name} numberOfLines={1}>{f.display_name}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => nudge(f)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('friends.nudge')} style={{ marginLeft: 10 }}>
                  <Ionicons name="hand-left-outline" size={21} color={c.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmRemove(f)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('friends.remove')} style={{ marginLeft: 18 }}>
                  <Ionicons name="person-remove-outline" size={20} color={c.textMuted} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Was die Freunde machen (Aktivitaets-Feed) */}
      {feed.length > 0 && (
        <View style={styles.card}>
          <GlassFill radius={20} />
          <SectionHead icon="pulse" title={t('friends.feed.label')} />
          {feed.map((item, i) => {
            const a = agoKey(item.created_at);
            const tint = item.type === 'record' ? '#F0B429' : item.type === 'cardio' ? '#38B6FF' : c.primary;
            const icon = item.type === 'record' ? 'trophy' : item.type === 'cardio' ? 'walk' : 'barbell';
            const text = feedText(item, t);
            return (
              <View key={item.id} style={[styles.row, i > 0 && styles.rowDivider]}>
                <View style={[styles.feedIcon, { backgroundColor: tint + '22' }]}><Ionicons name={icon as any} size={17} color={tint} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.feedText} numberOfLines={2}>{text}</Text>
                  <Text style={styles.feedTime}>{t(a.key, { n: a.n })}</Text>
                </View>
                <TouchableOpacity style={styles.kudosBtn} onPress={() => setOpenComments(item)} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('friends.comments.title')}>
                  <Ionicons name="chatbubble-outline" size={19} color={c.textMuted} />
                  {item.comment_count > 0 && <Text style={styles.kudosCount}>{item.comment_count}</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.kudosBtn} onPress={() => onKudos(item)} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('friends.feed.kudosA11y')}>
                  <Ionicons name={item.i_kudosed ? 'flame' : 'flame-outline'} size={22} color={item.i_kudosed ? '#F0574B' : c.textMuted} />
                  {item.kudos_count > 0 && <Text style={[styles.kudosCount, item.i_kudosed && { color: '#F0574B' }]}>{item.kudos_count}</Text>}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {openComments && (
        <FeedComments
          eventId={openComments.id}
          headerText={feedText(openComments, t)}
          myUserId={session?.user?.id ?? null}
          visible={!!openComments}
          onClose={() => setOpenComments(null)}
          onCountChange={(delta) => setFeed((prev) => prev.map((it) => it.id === openComments.id ? { ...it, comment_count: Math.max(0, it.comment_count + delta) } : it))}
        />
      )}

      {openProfile && (
        <FriendProfile
          friendCode={openProfile.friend_code}
          initialName={openProfile.display_name}
          visible={!!openProfile}
          onClose={() => setOpenProfile(null)}
        />
      )}

      {openThread && (
        <FeedComments
          eventId={openThread.eventId}
          headerText={openThread.headerText}
          myUserId={session?.user?.id ?? null}
          visible={!!openThread}
          onClose={() => setOpenThread(null)}
          onCountChange={() => {}}
        />
      )}
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    err: { color: c.danger, fontSize: 13, marginBottom: 8 },

    // Kompakter Code-Streifen
    codeStrip: { ...shadow, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderRadius: 20, padding: 16, marginTop: 14, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    codeStripLabel: { fontSize: 12, color: c.textMuted, fontWeight: '600', marginBottom: 3 },
    codeStripCode: { fontSize: 26, fontWeight: '900', letterSpacing: 5, color: c.heading },
    shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.primary, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 15 },
    shareText: { color: c.onPrimary, fontSize: 14, fontWeight: '800' },

    // Karten
    card: { ...shadow, backgroundColor: c.card, borderRadius: 20, padding: 16, marginTop: 14, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    input: { backgroundColor: c.inputBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 18, fontWeight: '700', letterSpacing: 2, color: c.text, borderWidth: 1, borderColor: c.border },
    addBtn: { backgroundColor: c.primary, borderRadius: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
    addText: { color: c.onPrimary, fontSize: 15, fontWeight: '800' },

    // Unterabschnitt innerhalb der Karte (feine Trennlinie statt neuer Kasten)
    sub: { marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },

    // Leerzustand
    emptyWrap: { alignItems: 'center', paddingVertical: 8 },
    emptyIcon: { fontSize: 30, marginBottom: 6 },
    empty: { fontSize: 14, color: c.textMuted, textAlign: 'center', lineHeight: 20 },

    // Zeilen
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.inputBg, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: c.heading, fontSize: 16, fontWeight: '800' },
    name: { flex: 1, fontSize: 15, color: c.text, fontWeight: '600' },
    friendTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    feedIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    feedText: { fontSize: 14, color: c.text, fontWeight: '600', lineHeight: 19 },
    feedTime: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    kudosBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 6 },
    kudosCount: { fontSize: 13, fontWeight: '800', color: c.textMuted },

    // "Aktivitaet bei dir" (Benachrichtigungen)
    notifHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    newPill: { backgroundColor: '#F0574B', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    newPillText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    notifBody: { fontSize: 13, color: c.textMuted, fontStyle: 'italic', marginTop: 1 },
    newDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#F0574B', marginLeft: 6 },
  });
}
