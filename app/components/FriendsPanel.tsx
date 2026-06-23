// Freunde-Bereich (#48c): zeigt den eigenen Freund-Code (teilbar), erlaubt Hinzufuegen per
// Code und listet die Freunde (mit Entfernen). Selbst-ladend; als Reiter im Lobby-Tab genutzt.
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import GlassFill from './GlassFill';
import { CARD_SHADOW as shadow } from '../lib/ui';
import { errorMessage } from '../lib/errors';
import { Friend, getMyFriendCode, fetchFriends, addFriendByCode, removeFriendByCode, sendNudge } from '../lib/friends';

export default function FriendsPanel({ focusTick }: { focusTick?: number }) {
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [myCode, setMyCode] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { load(); }, []);
  useEffect(() => { if (focusTick) load(); }, [focusTick]);

  async function load() {
    try {
      const [code, list] = await Promise.all([getMyFriendCode(), fetchFriends()]);
      setMyCode(code);
      setFriends(list);
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
      const name = await addFriendByCode(code);
      setBusy(false);
      if (!name) { Alert.alert(t('friends.notFound')); return; }
      setCodeInput('');
      await load();
      Alert.alert(t('friends.added', { name }));
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

  if (loading) return <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 30 }} />;

  return (
    <View>
      {err && <Text style={styles.err}>{err}</Text>}

      {/* Mein Code */}
      <View style={styles.codeTile}>
        <GlassFill radius={20} />
        <Text style={styles.codeLabel}>{t('friends.yourCode')}</Text>
        <Text style={styles.code} selectable>{myCode ?? '–'}</Text>
        <TouchableOpacity style={styles.shareBtn} onPress={share} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('friends.share')}>
          <Ionicons name="share-social" size={16} color="#fff" />
          <Text style={styles.shareText}>{t('friends.share')}</Text>
        </TouchableOpacity>
      </View>

      {/* Freund per Code hinzufuegen */}
      <View style={styles.tile}>
        <GlassFill radius={16} />
        <Text style={styles.label}>{t('friends.addHeading')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
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

      {/* Freundesliste */}
      <View style={styles.tile}>
        <GlassFill radius={16} />
        <Text style={styles.tileLabel}>{t('friends.listLabel', { n: friends.length })}</Text>
        {friends.length === 0 ? (
          <Text style={styles.empty}>{t('friends.empty')}</Text>
        ) : (
          friends.map((f, i) => (
            <View key={f.friend_code} style={[styles.row, i > 0 && styles.rowDivider]}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{(f.display_name.charAt(0) || '?').toUpperCase()}</Text></View>
              <Text style={styles.name} numberOfLines={1}>{f.display_name}</Text>
              <TouchableOpacity onPress={() => nudge(f)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('friends.nudge')} style={{ marginRight: 16 }}>
                <Ionicons name="hand-left-outline" size={20} color={c.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmRemove(f)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('friends.remove')}>
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

    codeTile: { ...shadow, backgroundColor: c.hero, borderRadius: 20, padding: 18, marginTop: 12, alignItems: 'center', overflow: 'hidden' },
    codeLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
    code: { color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: 6, marginTop: 6, marginLeft: 6 },
    shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16, marginTop: 12 },
    shareText: { color: '#fff', fontSize: 14, fontWeight: '800' },

    tile: { ...shadow, backgroundColor: c.card, borderRadius: 16, padding: 16, marginTop: 12, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    label: { fontSize: 13, color: c.text, fontWeight: '700', marginBottom: 8 },
    tileLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: c.textMuted, marginBottom: 4 },
    input: { backgroundColor: c.inputBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 18, fontWeight: '700', letterSpacing: 2, color: c.text, borderWidth: 1, borderColor: c.border },
    addBtn: { backgroundColor: c.primary, borderRadius: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
    addText: { color: c.onPrimary, fontSize: 15, fontWeight: '800' },

    empty: { fontSize: 14, color: c.textMuted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 10, lineHeight: 20 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(25,201,143,0.16)', alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: c.primary, fontSize: 16, fontWeight: '800' },
    name: { flex: 1, fontSize: 15, color: c.text, fontWeight: '600' },
  });
}
