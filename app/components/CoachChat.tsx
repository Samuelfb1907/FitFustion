// "Frag den Coach" (#1) - Vollbild-Chat (in einem Modal). Premium wird vom Aufrufer (Home)
// gegatet; Einwilligung (DSGVO/KI) + Tageslimit prueft die Edge Function serverseitig.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useKeyboardHeight } from '../lib/useKeyboardHeight';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT, useLang } from '../contexts/LanguageContext';
import { askCoach, CoachMessage } from '../lib/coach';
import { workoutsLast7Days } from '../lib/coachContext';

type Msg = CoachMessage & { error?: boolean };

export default function CoachChat({ onClose }: { onClose: () => void }) {
  const { session, profile } = useAuth();
  const c = useColors();
  const t = useT();
  const { lang } = useLang();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [askConsent, setAskConsent] = useState(false);
  const [w7, setW7] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const kb = useKeyboardHeight();

  useEffect(() => {
    const uid = session?.user?.id;
    if (uid) workoutsLast7Days(uid).then(setW7).catch(() => {});
  }, [session?.user?.id]);

  const STARTERS = [t('coach.starter1'), t('coach.starter2'), t('coach.starter3')];
  const scrollDown = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);

  // DSGVO-schonender Trainings-Kontext (KEINE Koerper-/Gewichtsdaten).
  function buildContext(): string {
    const parts: string[] = [];
    const exp = profile?.experience_level as string | undefined;
    const env = profile?.training_environment as string | undefined;
    if (exp) {
      const m: Record<string, string> = lang === 'en'
        ? { beginner: 'beginner', intermediate: 'intermediate', advanced: 'advanced' }
        : { beginner: 'Anfaenger', intermediate: 'Fortgeschritten', advanced: 'Profi' };
      parts.push((lang === 'en' ? 'experience: ' : 'Erfahrung: ') + (m[exp] ?? exp));
    }
    if (env) {
      const m: Record<string, string> = lang === 'en'
        ? { gym: 'gym', home: 'at home' }
        : { gym: 'Fitnessstudio', home: 'Zuhause' };
      parts.push((lang === 'en' ? 'trains: ' : 'Trainingsort: ') + (m[env] ?? env));
    }
    if (w7 != null) parts.push(lang === 'en' ? `${w7} workouts in the last 7 days` : `${w7} Workouts in den letzten 7 Tagen`);
    return parts.join(' · ');
  }

  async function runSend(history: Msg[]) {
    setSending(true);
    scrollDown();
    const payload: CoachMessage[] = history.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
    const res = await askCoach(payload, lang, buildContext());
    setSending(false);
    if ('reply' in res) {
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply.trim() || t('coach.empty') }]);
    } else if (res.error === 'consent_required') {
      setAskConsent(true);
    } else {
      const key = res.error === 'rate_limited' ? 'coach.errRate' : res.error === 'premium_required' ? 'coach.errPremium' : 'coach.errGeneric';
      setMessages((prev) => [...prev, { role: 'assistant', content: t(key), error: true }]);
    }
    scrollDown();
  }

  function pushAndSend(text: string) {
    const clean = text.trim();
    if (!clean || sending) return;
    const next: Msg[] = [...messages, { role: 'user', content: clean }];
    setMessages(next);
    setInput('');
    runSend(next);
  }

  async function acceptConsent() {
    const now = new Date().toISOString();
    setAskConsent(false);
    try { await AsyncStorage.setItem('fitavo.aiConsentAt', now); } catch {}
    const uid = session?.user?.id;
    if (uid) supabase.from('profiles').update({ ai_consent_at: now }).eq('id', uid).then(() => {}, () => {});
    runSend(messages); // die zuletzt gesendete Nutzer-Nachricht steht schon in messages
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.botIcon}><Text style={{ fontSize: 18 }}>🤖</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('coach.title')}</Text>
          <Text style={styles.subtitle}>{t('coach.subtitle')}</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('common.close')}>
          <Ionicons name="close" size={26} color={c.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, paddingBottom: kb }}>
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {messages.length === 0 && !askConsent && (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>{t('coach.emptyTitle')}</Text>
              <Text style={styles.emptyHint}>{t('coach.emptyHint')}</Text>
              <View style={{ gap: 8, marginTop: 16, alignSelf: 'stretch' }}>
                {STARTERS.map((s, i) => (
                  <TouchableOpacity key={i} style={styles.starter} onPress={() => pushAndSend(s)} activeOpacity={0.8}>
                    <Text style={styles.starterText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {messages.map((m, i) => (
            <View key={i} style={[styles.bubbleRow, m.role === 'user' ? styles.rowRight : styles.rowLeft]}>
              <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleBot, m.error && styles.bubbleErr]}>
                <Text style={[styles.bubbleText, m.role === 'user' && { color: c.onPrimary }]}>{m.content}</Text>
              </View>
            </View>
          ))}

          {sending && (
            <View style={[styles.bubbleRow, styles.rowLeft]}>
              <View style={[styles.bubble, styles.bubbleBot]}><ActivityIndicator color={c.primary} /></View>
            </View>
          )}

          {askConsent && (
            <View style={styles.consentCard}>
              <Text style={styles.consentTitle}>{t('food.consentTitle')}</Text>
              <Text style={styles.consentBody}>{t('food.consentBody')}</Text>
              <TouchableOpacity style={styles.consentBtn} onPress={acceptConsent} activeOpacity={0.85}>
                <Text style={styles.consentBtnText}>{t('food.consentAccept')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {messages.length > 0 && <Text style={styles.disclaimer}>{t('coach.disclaimer')}</Text>}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('coach.inputPlaceholder')}
            placeholderTextColor={c.textMuted}
            multiline
            maxLength={500}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.4 }]}
            onPress={() => pushAndSend(input)}
            disabled={!input.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel={t('coach.send')}
          >
            <Ionicons name="arrow-up" size={22} color={c.onPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg, paddingTop: 52 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.cardBorder },
    botIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(25,201,143,0.16)', alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 17, fontWeight: '800', color: c.heading },
    subtitle: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    scroll: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 16 },
    empty: { alignItems: 'center', paddingTop: 24, paddingHorizontal: 8 },
    emptyEmoji: { fontSize: 40, marginBottom: 8 },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: c.heading, textAlign: 'center' },
    emptyHint: { fontSize: 14, color: c.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
    starter: { backgroundColor: c.inputBg, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16, borderWidth: 1, borderColor: c.border },
    starterText: { fontSize: 14, color: c.text, fontWeight: '600' },
    bubbleRow: { flexDirection: 'row', marginBottom: 10 },
    rowRight: { justifyContent: 'flex-end' },
    rowLeft: { justifyContent: 'flex-start' },
    bubble: { maxWidth: '86%', borderRadius: 18, paddingVertical: 11, paddingHorizontal: 14 },
    bubbleUser: { backgroundColor: c.primary, borderBottomRightRadius: 5 },
    bubbleBot: { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderBottomLeftRadius: 5 },
    bubbleErr: { backgroundColor: 'rgba(214,69,69,0.12)', borderColor: 'rgba(214,69,69,0.4)' },
    bubbleText: { fontSize: 15, color: c.text, lineHeight: 21 },
    consentCard: { backgroundColor: c.inputBg, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.border, marginTop: 4 },
    consentTitle: { fontSize: 16, fontWeight: '800', color: c.heading, marginBottom: 8 },
    consentBody: { fontSize: 13, color: c.text, lineHeight: 19, marginBottom: 14 },
    consentBtn: { backgroundColor: c.primary, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
    consentBtnText: { color: c.onPrimary, fontSize: 15, fontWeight: '800' },
    disclaimer: { fontSize: 11, color: c.textMuted, textAlign: 'center', marginTop: 8, paddingHorizontal: 16, lineHeight: 16 },
    inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 24, borderTopWidth: 1, borderTopColor: c.cardBorder },
    input: { flex: 1, maxHeight: 120, backgroundColor: c.inputBg, borderRadius: 20, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 15, color: c.text, borderWidth: 1, borderColor: c.border },
    sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  });
}
