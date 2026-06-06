// Login-/Registrierungs-Screen – professionell, mit dezentem Punkteraster-Hintergrund (SVG).
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useColors, Colors } from '../contexts/ThemeContext';
import LegalText from '../components/LegalText';
import { DISCLAIMER_VERSION } from '../lib/legal';

function translateError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-Mail oder Passwort ist falsch.';
  if (m.includes('already registered')) return 'Diese E-Mail ist bereits registriert. Bitte logge dich ein.';
  if (m.includes('password should be at least')) return 'Das Passwort ist zu kurz (mindestens 8 Zeichen).';
  if (m.includes('invalid email') || m.includes('unable to validate email')) return 'Bitte eine gültige E-Mail-Adresse eingeben.';
  if (m.includes('email not confirmed')) return 'Bitte bestätige zuerst deine E-Mail (Postfach prüfen).';
  return msg;
}

export default function AuthScreen() {
  const c = useColors();
  const styles = makeStyles(c);
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

  async function forgotPassword() {
    if (!email) { show('Bitte zuerst deine E-Mail-Adresse oben eingeben.', true); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    show(error ? translateError(error.message) : 'E-Mail zum Zurücksetzen gesendet – bitte Postfach prüfen.', !!error);
  }

  const submitDisabled = loading || (mode === 'register' && !accepted);

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <View style={styles.logo}><Text style={styles.logoMark}>F</Text></View>
            <Text style={styles.wordmark}>FitAvo</Text>
            <Text style={styles.tagline}>FITNESS · ERNÄHRUNG · FORTSCHRITT</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.heading}>{mode === 'login' ? 'Anmelden' : 'Konto erstellen'}</Text>
            <Text style={styles.sub}>{mode === 'login' ? 'Melde dich an, um weiterzumachen.' : 'In unter einer Minute startklar.'}</Text>

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
              <TouchableOpacity onPress={forgotPassword} disabled={loading} style={styles.forgotWrap} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
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
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    flex: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: 'flex-start', paddingHorizontal: 28, paddingTop: 64, paddingBottom: 48 },

    brand: { alignItems: 'center', marginBottom: 36 },
    logo: { width: 60, height: 60, borderRadius: 18, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    logoMark: { color: c.onPrimary, fontSize: 30, fontWeight: '800' },
    wordmark: { fontSize: 28, fontWeight: '800', color: c.heading, letterSpacing: 0.2 },
    tagline: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: c.textMuted, marginTop: 8 },

    form: { width: '100%', maxWidth: 420, alignSelf: 'center' },
    heading: { fontSize: 22, fontWeight: '800', color: c.heading },
    sub: { fontSize: 14, color: c.textMuted, marginTop: 6 },

    fieldWrap: { marginTop: 18 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: c.text, marginBottom: 8 },
    fieldInput: {
      backgroundColor: c.inputBg, borderWidth: 1.5, borderColor: 'transparent', borderRadius: 12,
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
  });
}
