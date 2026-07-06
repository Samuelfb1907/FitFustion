// Kommentar-Sheet fuer eine Freundes-Aktivitaet (Phase 1b). Laedt Kommentare per RPC,
// erlaubt Schreiben und Loeschen eigener Kommentare. Zaehler-Aenderung geht per Callback
// zurueck an den Feed (FriendsPanel).
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import { CommentItem, fetchComments, addComment, deleteComment } from '../lib/activity';
import { hTap } from '../lib/haptics';

function ago(iso: string, t: (k: string, p?: Record<string, string | number>) => string): string {
  const min = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return t('friends.feed.minAgo', { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t('friends.feed.hAgo', { n: h });
  return t('friends.feed.dAgo', { n: Math.floor(h / 24) });
}

export default function FeedComments({ eventId, headerText, myUserId, visible, onClose, onCountChange }: {
  eventId: string; headerText: string; myUserId: string | null; visible: boolean; onClose: () => void; onCountChange: (delta: number) => void;
}) {
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [items, setItems] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [kb, setKb] = useState(0);

  // Tastaturhoehe verfolgen und das Sheet genau darum anheben. RN-Modal ignoriert das
  // Android-adjustResize, darum loesen wir es selbst (funktioniert iOS + Android gleich).
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, (e) => setKb(e.endCoordinates?.height ?? 0));
    const h = Keyboard.addListener(hideEvt, () => setKb(0));
    return () => { s.remove(); h.remove(); };
  }, []);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    setText('');
    fetchComments(eventId).then((cs) => { if (active) { setItems(cs); setLoading(false); } });
    return () => { active = false; };
  }, [visible, eventId]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const nc = await addComment(eventId, body);
    setSending(false);
    if (nc) { setItems((p) => [...p, nc]); setText(''); onCountChange(1); hTap(); }
  }

  function confirmDelete(cm: CommentItem) {
    Alert.alert(t('friends.comments.deleteTitle'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
          await deleteComment(cm.id);
          setItems((p) => p.filter((x) => x.id !== cm.id));
          onCountChange(-1);
        } },
    ]);
  }

  const initial = (n: string) => (n.charAt(0) || '?').toUpperCase();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Tippen neben dem Sheet (abgedunkelter Bereich) schliesst es. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('friends.comments.close')} />
        <View style={[styles.sheet, { paddingBottom: 22 + kb }]}>
          <View style={styles.head}>
            <Text style={styles.title}>{t('friends.comments.title')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('friends.comments.close')}>
              <Ionicons name="close" size={24} color={c.textMuted} />
            </TouchableOpacity>
          </View>
          {!!headerText && <Text style={styles.context} numberOfLines={2}>{headerText}</Text>}
          {loading ? (
            <ActivityIndicator color={c.primary} style={{ marginVertical: 30 }} />
          ) : (
            <ScrollView style={{ maxHeight: kb > 0 ? 220 : 320 }} contentContainerStyle={{ paddingVertical: 4 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {items.length === 0 ? (
                <Text style={styles.empty}>{t('friends.comments.empty')}</Text>
              ) : items.map((cm) => (
                <TouchableOpacity key={cm.id} activeOpacity={cm.user_id === myUserId ? 0.6 : 1} onLongPress={cm.user_id === myUserId ? () => confirmDelete(cm) : undefined} style={styles.cRow}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{initial(cm.display_name)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cName} numberOfLines={1}>{cm.display_name}<Text style={styles.cTime}>  ·  {ago(cm.created_at, t)}</Text></Text>
                    <Text style={styles.cBody}>{cm.body}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <View style={styles.inputRow}>
            <TextInput style={styles.input} value={text} onChangeText={setText} placeholder={t('friends.comments.placeholder')} placeholderTextColor={c.textMuted} maxLength={300} multiline underlineColorAndroid="transparent" />
            <TouchableOpacity style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]} onPress={send} disabled={!text.trim() || sending} accessibilityRole="button" accessibilityLabel={t('friends.comments.sendA11y')}>
              {sending ? <ActivityIndicator color={c.onPrimary} size="small" /> : <Ionicons name="arrow-up" size={20} color={c.onPrimary} />}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 22 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 18, fontWeight: '800', color: c.heading },
    context: { fontSize: 13, color: c.textMuted, marginTop: 4, marginBottom: 6 },
    empty: { fontSize: 14, color: c.textMuted, textAlign: 'center', paddingVertical: 26, lineHeight: 20 },
    cRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 9 },
    avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.inputBg, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: c.heading, fontSize: 15, fontWeight: '800' },
    cName: { fontSize: 13, fontWeight: '700', color: c.heading },
    cTime: { fontSize: 12, fontWeight: '500', color: c.textMuted },
    cBody: { fontSize: 14, color: c.text, lineHeight: 19, marginTop: 1 },
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, paddingTop: 12 },
    input: { flex: 1, backgroundColor: c.inputBg, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: c.text, borderWidth: 1, borderColor: c.border, maxHeight: 110 },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  });
}
