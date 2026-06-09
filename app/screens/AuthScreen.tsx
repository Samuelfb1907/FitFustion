// Login-/Registrierungs-Screen – Clean-Light, mit dezentem Smaragd-Hintergrund (Ambient).
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useColors, Colors } from '../contexts/ThemeContext';
import LegalText from '../components/LegalText';
import { DISCLAIMER_VERSION } from '../lib/legal';
import Ambient from '../components/Ambient';
import GlassFill from '../components/GlassFill';

function translateError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-Mail oder Passwort ist falsch.';
  if (m.includes('already registered')) return 'Mit diesen Daten ist keine Registrierung möglich. Falls du bereits ein Konto hast, melde dich bitte an.';
  if (m.includes('password should be at least')) return 'Das Passwort ist zu kurz (mindestens 8 Zeichen).';
  if (m.includes('invalid email') || m.includes('unable to validate email')) return 'Bitte eine gültige E-Mail-Adresse eingeben.';
  if (m.includes('email not confirmed')) return 'Bitte bestätige zuerst deine E-Mail (Postfach prüfen).';
  return msg;
}

export default function AuthScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [focused, setFocused] = useState<'email' | 'pw' | null>(null);
  const pwRef = useRef<TextInput>(null);
  const [showPw, setShowPw] = useState(false);
  // Passwort-Zuruecksetzen per 6-stelligem Code (funktioniert ohne Deep-Link)
  const [showReset, setShowReset] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'code'>('request');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPw, setResetNewPw] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetErr, setResetErr] = useState(false);

  function show(message: string, error: boolean) { setInfo(message); setIsError(error); }
  function switchMode(m: 'login' | 'register') { setMode(m); setInfo(null); }

  async function handleSubmit() {
    setInfo(null);
    if (!email || !password) { show('Bitte E-Mail und Passwort eingeben.', true); return; }
    if (mode === 'register' && password.length < 8) { show('Bitte ein Passwort mit mindestens 8 Zeichen wählen.', true); return; }
    if (mode === 'register' && !accepted) { show('Bitte bestätige den Haftungsausschluss & Gesundheitshinweis, um fortzufahren.', true); return; }
    setLoading(true);
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) show(translateError(error.message), true);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) show(translateError(error.message), true);
      else {
        // Zustimmung zum Haftungsausschluss dokumentieren (Zeitpunkt + Version)
        try { await AsyncStorage.setItem('fitavo.disclaimerAccepted', JSON.stringify({ version: DISCLAIMER_VERSION, at: new Date().toISOString() })); } catch {}
        if (!data.session) { show('Fast geschafft! Bitte bestätige deine E-Mail und logge dich dann ein.', false); setMode('login'); }
      }
    }
    setLoading(false);
  }

  function openReset() {
    if (!email) { show('Bitte zuerst deine E-Mail-Adresse oben eingeben.', true); return; }
    setResetStep('request'); setResetCode(''); setResetNewPw(''); setResetMsg(null); setResetErr(false);
    setShowReset(true);
  }
  async function sendResetCode() {
    setResetBusy(true); setResetMsg(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setResetBusy(false);
    if (error) { setResetMsg(translateError(error.message)); setResetErr(true); return; }
    setResetStep('code'); setResetMsg('Wir haben dir einen 6-stelligen Code per E-Mail geschickt.'); setResetErr(false);
  }
  async function confirmReset() {
    if (resetCode.trim().length < 6) { setResetMsg('Bitte den 6-stelligen Code eingeben.'); setResetErr(true); return; }
    if (resetNewPw.length < 8) { setResetMsg('Neues Passwort: mindestens 8 Zeichen.'); setResetErr(true); return; }
    setResetBusy(true); setResetMsg(null);
    const { error: vErr } = await supabase.auth.verifyOtp({ email, token: resetCode.trim(), type: 'recovery' });
    if (vErr) { setResetBusy(false); setResetMsg('Code ungültig oder abgelaufen.'); setResetErr(true); return; }
    const { error: uErr } = await supabase.auth.updateUser({ password: resetNewPw });
    setResetBusy(false);
    if (uErr) { setResetMsg('Konnte Passwort nicht setzen: ' + uErr.message); setResetErr(true); return; }
    // verifyOtp hat eine Session gesetzt -> App wechselt automatisch (eingeloggt).
    setShowReset(false);
  }

  const submitDisabled = loading || (mode === 'register' && !accepted);

  return (
    <View style={styles.root}>
      <Ambient c={c} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <View style={styles.logoBadge}>
              <Image source={require('../assets/avocado.png')} style={styles.logoImg} resizeMode="cover" />
            </View>
            <Text style={styles.wordmark}>FitAvo</Text>
            <Text style={styles.tagline}>Trainiere smarter. Iss bewusster. 🥑</Text>
          </View>

          <View style={styles.form}>
            <GlassFill radius={22} />
            <Text style={styles.heading}>{mode === 'login' ? 'Willkommen zurück' : 'Werde Teil von FitAvo'}</Text>
            <Text style={styles.sub}>{mode === 'login' ? 'Schön, dass du wieder da bist 👋' : 'In unter einer Minute startklar 🚀'}</Text>

            {info && (
              <View style={[styles.infoBox, { borderLeftColor: isError ? c.danger : c.success }]}>
                <Text style={[styles.info, { color: isError ? c.danger : c.success }]}>{info}</Text>
              </View>
            )}

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>E-Mail</Text>
              <TextInput
                style={[styles.fieldInput, focused === 'email' && styles.fieldInputFocused]}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                placeholder="du@beispiel.de"
                placeholderTextColor={c.textMuted}
                autoCapitalize="none" autoCorrect={false} keyboardType="email-address" inputMode="email"
                underlineColorAndroid="transparent"
                returnKeyType="next"
                onSubmitEditing={() => pwRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Passwort</Text>
              <View>
                <TextInput
                  ref={pwRef}
                  style={[styles.fieldInput, focused === 'pw' && styles.fieldInputFocused, { paddingRight: 48 }]}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocused('pw')}
                  onBlur={() => setFocused(null)}
                  placeholder={mode === 'register' ? 'mindestens 8 Zeichen' : 'Passwort'}
                  placeholderTextColor={c.textMuted}
                  secureTextEntry={!showPw} autoCapitalize="none"
                  underlineColorAndroid="transparent"
                  returnKeyType={mode === 'login' ? 'go' : 'done'}
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity style={styles.pwToggle} onPress={() => setShowPw((s) => !s)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={showPw ? 'Passwort verbergen' : 'Passwort anzeigen'}>
                  <Text style={styles.pwToggleText}>{showPw ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {mode === 'login' && (
              <TouchableOpacity onPress={openReset} disabled={loading} style={styles.forgotWrap} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Text style={styles.forgot}>Passwort vergessen?</Text>
              </TouchableOpacity>
            )}

            {mode === 'register' && (
              <TouchableOpacity style={styles.acceptRow} onPress={() => setAccepted((a) => !a)} activeOpacity={0.7}>
                <View style={[styles.checkbox, accepted && styles.checkboxOn]}>{accepted && <Text style={styles.checkmark}>✓</Text>}</View>
                <Text style={styles.acceptText}>
                  Ich habe den{' '}
                  <Text style={styles.acceptLink} onPress={() => setShowLegal(true)}>Haftungsausschluss & Gesundheitshinweis</Text>
                  {' '}gelesen und akzeptiere ihn.
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.button, submitDisabled && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitDisabled} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.buttonText}>{mode === 'login' ? 'Einloggen' : 'Konto erstellen'}</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.switchWrap} onPress={() => switchMode(mode === 'login' ? 'register' : 'login')} activeOpacity={0.7}>
              <Text style={styles.switchText}>
                {mode === 'login' ? 'Noch kein Konto? ' : 'Schon ein Konto? '}
                <Text style={styles.switchLink}>{mode === 'login' ? 'Jetzt registrieren' : 'Zum Login'}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showLegal} animationType="slide" onRequestClose={() => setShowLegal(false)}>
        <View style={styles.modalRoot}>
          <Text style={styles.modalTitle}>Haftungsausschluss & Gesundheitshinweis</Text>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <LegalText c={c} />
          </ScrollView>
          <TouchableOpacity style={styles.button} onPress={() => { setAccepted(true); setShowLegal(false); }} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Gelesen & akzeptieren</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowLegal(false)} style={{ marginTop: 14 }}>
            <Text style={styles.modalClose}>Schließen</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={showReset} animationType="slide" transparent onRequestClose={() => setShowReset(false)}>
        <View style={styles.resetOverlay}>
          <View style={styles.resetCard}>
            <GlassFill radius={18} />
            <Text style={styles.modalTitle}>Passwort zurücksetzen</Text>
            {resetStep === 'request' ? (
              <>
                <Text style={styles.resetText}>Wir senden einen 6-stelligen Code an:</Text>
                <Text style={styles.resetEmail}>{email || '—'}</Text>
                <TouchableOpacity style={styles.button} onPress={sendResetCode} disabled={resetBusy} activeOpacity={0.85}>
                  {resetBusy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.buttonText}>Code senden</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Code aus der E-Mail</Text>
                <TextInput style={styles.fieldInput} value={resetCode} onChangeText={setResetCode} keyboardType="number-pad" placeholder="6-stelliger Code" placeholderTextColor={c.textMuted} maxLength={8} autoCapitalize="none" />
                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Neues Passwort</Text>
                <TextInput style={styles.fieldInput} value={resetNewPw} onChangeText={setResetNewPw} secureTextEntry autoCapitalize="none" placeholder="mindestens 8 Zeichen" placeholderTextColor={c.textMuted} />
                <TouchableOpacity style={styles.button} onPress={confirmReset} disabled={resetBusy} activeOpacity={0.85}>
                  {resetBusy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.buttonText}>Passwort setzen & einloggen</Text>}
                </TouchableOpacity>
              </>
            )}
            {resetMsg && <Text style={[styles.info, { color: resetErr ? c.danger : c.success, marginTop: 12 }]}>{resetMsg}</Text>}
            <TouchableOpacity onPress={() => setShowReset(false)} style={{ marginTop: 14 }}>
              <Text style={styles.modalClose}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    flex: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingTop: 48, paddingBottom: 48 },

    brand: { alignItems: 'center', marginBottom: 26 },
    logoBadge: { width: 152, height: 152, borderRadius: 40, backgroundColor: '#FFFFFF', marginBottom: 18, shadowColor: c.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 22, elevation: 12 },
    logoImg: { width: 152, height: 152, borderRadius: 40, overflow: 'hidden' },
    wordmark: { fontSize: 34, fontWeight: '900', color: c.heading, letterSpacing: 0.2 },
    tagline: { fontSize: 14, fontWeight: '600', color: c.textMuted, marginTop: 10, textAlign: 'center' },

    form: { width: '100%', maxWidth: 420, alignSelf: 'center', borderRadius: 22, padding: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 6 },
    heading: { fontSize: 22, fontWeight: '800', color: c.heading },
    sub: { fontSize: 14, color: c.textMuted, marginTop: 6 },

    fieldWrap: { marginTop: 18 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: c.text, marginBottom: 8 },
    fieldInput: {
      backgroundColor: c.inputBg, borderWidth: 1.5, borderColor: c.border, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: c.text,
    },
    fieldInputFocused: { borderColor: c.primary, backgroundColor: c.card },
    pwToggle: { position: 'absolute', right: 6, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 10 },
    pwToggleText: { fontSize: 18 },

    forgotWrap: { alignSelf: 'flex-end', marginTop: 12 },
    forgot: { color: c.primary, fontSize: 13, fontWeight: '600' },

    button: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
    buttonDisabled: { opacity: 0.45 },
    buttonText: { color: c.onPrimary, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

    infoBox: { backgroundColor: c.inputBg, borderLeftWidth: 3, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, marginTop: 18 },
    info: { fontSize: 14, lineHeight: 19 },

    switchWrap: { marginTop: 24, alignItems: 'center' },
    switchText: { fontSize: 14, color: c.textMuted },
    switchLink: { color: c.primary, fontWeight: '700' },

    acceptRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 18 },
    checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: c.border, alignItems: 'center', justifyContent: 'center', marginRight: 11, marginTop: 1 },
    checkboxOn: { backgroundColor: c.primary, borderColor: c.primary },
    checkmark: { color: c.onPrimary, fontSize: 15, fontWeight: '800' },
    acceptText: { flex: 1, fontSize: 13, color: c.textMuted, lineHeight: 19 },
    acceptLink: { color: c.primary, fontWeight: '700' },

    modalRoot: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 22, paddingTop: 60, paddingBottom: 24 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: c.heading, marginBottom: 14 },
    modalClose: { textAlign: 'center', color: c.textMuted, fontSize: 14 },
    resetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 22 },
    resetCard: { backgroundColor: c.card, borderRadius: 18, padding: 22, borderWidth: 1, borderColor: c.cardBorder },
    resetText: { fontSize: 14, color: c.textMuted, lineHeight: 19 },
    resetEmail: { fontSize: 15, color: c.heading, fontWeight: '700', marginTop: 4, marginBottom: 4 },
  });
}
