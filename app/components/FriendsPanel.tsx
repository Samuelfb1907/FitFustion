// Freunde-Bereich (#48c): eigener Freund-Code (teilbar), Hinzufuegen per Code, Anfragen,
// Aktivitaets-Feed und Freundesliste. Selbst-ladend; als Reiter im Lobby-Tab genutzt.
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
import { FeedItem, fetchFriendsFeed } from '../lib/activity';

// Relativer Zeitstempel fuer den Feed: gibt i18n-Key + Zahl zurueck.
function agoKey(iso: string): { key: string; n: number } {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.max(1, Math.floor(diff / 60000));
  if (min < 60) return { key: 'friends.feed.minAgo', n: min };
  const h = Math.floor(min / 60);
  if (h < 24) return { key: 'friends.feed.hAgo', n: h };
  return { key: 'friends.feed.dAgo', n: Math.floor(h / 24) };
}

export default function FriendsPanel({ focusTick }: { focusTick?: number }) {
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [myCode, setMyCode] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { load(); }, []);
  useEffect(() => { if (focusTick) load(); }, [focusTick]);

  async function load() {
    try {
      const [code, list, reqs, fd] = await Promise.all([
        getMyFriendCode(),
        fetchFriends(),
        incomingRequests().catch(() => [] as FriendRequest[]),
        fetchFriendsFeed().catch(() => [] as FeedItem[]),
      ]);
      setMyCode(code);
      setFriends(list);
      setRequests(reqs);
      setFeed(fd);
      setErr(null);
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

  if (loading) return <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 30 }} />;

  return (
    <View>
      {err && <Text style={styles.err}>{err}</Text>}

      {/* Mein Code (Hero) */}
      <View style={styles.hero}>
        <GlassFill radius={22} />
        <Text style={styles.heroLabel}>{t('friends.yourCode')}</Text>
        <Text style={styles.code} selectable>{myCode ?? '–'}</Text>
        <TouchableOpacity style={styles.shareBtn} onPress={share} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('friends.share')}>
          <Ionicons name="share-social" size={16} color="#fff" />
          <Text style={styles.shareText}>{t('friends.share')}</Text>
        </TouchableOpacity>
      </View>

      {/* Freund per Code hinzufuegen */}
      <View style={styles.card}>
        <GlassFill radius={20} />
        <SectionHead icon="person-add" title={t('friends.addHeading')} />
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
      </View>

      {/* Eingehende Freundschaftsanfragen */}
      {requests.length > 0 && (
        <View style={styles.card}>
          <GlassFill radius={20} />
          <SectionHead icon="person-add" title={t('friends.requestsLabel', { n: requests.length })} tint="#F0B429" />
          {requests.map((r, i) => (
            <View key={r.friend_code} style={[styles.row, i > 0 && styles.rowDivider]}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{(r.display_name.charAt(0) || '?').toUpperCase()}</Text></View>
              <Text style={styles.name} numberOfLines={1}>{r.display_name}</Text>
              <TouchableOpacity onPress={() => accept(r)} disabled={busy} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('friends.accept')} style={{ marginRight: 12 }}>
                <Ionicons name="checkmark-circle" size={28} color={c.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => decline(r)} disabled={busy} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('friends.decline')}>
                <Ionicons name="close-circle-outline" size={28} color={c.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Was die Freunde machen (Aktivitaets-Feed) */}
      {feed.length > 0 && (
        <View style={styles.card}>
          <GlassFill radius={20} />
          <SectionHead icon="pulse" title={t('friends.feed.label')} />
          {feed.map((item, i) => {
            const a = agoKey(item.created_at);
            const isRec = item.type === 'record';
            const tint = isRec ? '#F0B429' : c.primary;
            const text = isRec
              ? (item.detail ? t('friends.feed.recordEx', { name: item.display_name, ex: item.detail }) : t('friends.feed.record', { name: item.display_name }))
              : t('friends.feed.trained', { name: item.display_name });
            return (
              <View key={i} style={[styles.row, i > 0 && styles.rowDivider]}>
                <View style={[styles.avatar, { backgroundColor: tint + '22' }]}><Ionicons name={isRec ? 'trophy' : 'barbell'} size={18} color={tint} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.feedText} numberOfLines={2}>{text}</Text>
                  <Text style={styles.feedTime}>{t(a.key, { n: a.n })}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Freundesliste */}
      <View style={styles.card}>
        <GlassFill radius={20} />
        <SectionHead icon="people" title={t('friends.listLabel', { n: friends.length })} />
        {friends.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🤝</Text>
            <Text style={styles.empty}>{t('friends.empty')}</Text>
          </View>
        ) : (
          friends.map((f, i) => (
            <View key={f.friend_code} style={[styles.row, i > 0 && styles.rowDivider]}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{(f.display_name.charAt(0) || '?').toUpperCase()}</Text></View>
              <Text style={styles.name} numberOfLines={1}>{f.display_name}</Text>
              <TouchableOpacity onPress={() => nudge(f)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('friends.nudge')} style={styles.iconBtn}>
                <Ionicons name="hand-left-outline" size={20} color={c.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmRemove(f)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('friends.remove')} style={styles.iconBtn}>
                <Ionicons name="person-remove-outline" size={20} color={c.textMuted} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    err: { color: c.danger, fontSize: 13, marginBottom: 8 },

    // Eigener Code (Hero)
    hero: { ...shadow, backgroundColor: c.hero, borderRadius: 22, padding: 20, marginTop: 14, alignItems: 'center', overflow: 'hidden' },
    heroLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
    code: { color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: 6, marginTop: 8, marginLeft: 6 },
    shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 18, marginTop: 14 },
    shareText: { color: '#fff', fontSize: 14, fontWeight: '800' },

    // Einheitliche Karten
    card: { ...shadow, backgroundColor: c.card, borderRadius: 20, padding: 16, marginTop: 14, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    input: { backgroundColor: c.inputBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 18, fontWeight: '700', letterSpacing: 2, color: c.text, borderWidth: 1, borderColor: c.border },
    addBtn: { backgroundColor: c.primary, borderRadius: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
    addText: { color: c.onPrimary, fontSize: 15, fontWeight: '800' },

    // Leerzustand
    emptyWrap: { alignItems: 'center', paddingVertical: 10 },
    emptyIcon: { fontSize: 32, marginBottom: 8 },
    empty: { fontSize: 14, color: c.textMuted, textAlign: 'center', lineHeight: 20 },

    // Zeilen (Anfragen / Feed / Freunde)
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(25,201,143,0.16)', alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: c.primary, fontSize: 16, fontWeight: '800' },
    name: { flex: 1, fontSize: 15, color: c.text, fontWeight: '600' },
    iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: c.inputBg },
    feedText: { fontSize: 14, color: c.text, fontWeight: '600', lineHeight: 19 },
    feedTime: { fontSize: 12, color: c.textMuted, marginTop: 1 },
  });
}
