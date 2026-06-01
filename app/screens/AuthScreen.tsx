// Login-/Registrierungs-Screen – Hero-oben + aufsteigendes Sheet-Layout.
import { useState } from 'react';
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
        try { await AsyncStorage.setItem('fitfusion.disclaimerAccepted', JSON.stringify({ version: DISCLAIMER_VERSION, at: new Date().toISOString() })); } catch {}
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
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* HERO */}
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>🏋️  FITFUSION</Text>
        <Text style={styles.heroTitle}>Tracke dein Training{'\n'}& deinen Fortschritt.</Text>
      </View>

      {/* SHEET */}
      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.tabs}>
            <TouchableOpacity style={[styles.tab, mode === 'login' && styles.tabActive]} onPress={() => switchMode('login')} activeOpacity={0.7}>
              <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, mode === 'register' && styles.tabActive]} onPress={() => switchMode('register')} activeOpacity={0.7}>
              <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>Registrieren</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.welcome}>{mode === 'login' ? 'Schön, dich wiederzusehen 👋' : 'Erstelle dein Konto'}</Text>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>E-MAIL</Text>
            <TextInput
              style={[styles.fieldInput, focused === 'email' && styles.fieldInputFocused]}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              placeholder="du@beispiel.de"
              placeholderTextColor={c.textMuted}
              autoCapitalize="none" autoCorrect={false} keyboardType="email-address" inputMode="email"
            />
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>PASSWORT</Text>
            <TextInput
              style={[styles.fieldInput, focused === 'pw' && styles.fieldInputFocused]}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocused('pw')}
              onBlur={() => setFocused(null)}
              placeholder={mode === 'register' ? 'mindestens 8 Zeichen' : 'Passwort'}
              placeholderTextColor={c.textMuted}
              secureTextEntry autoCapitalize="none"
            />
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

          {info && (
            <View style={[styles.infoBox, { borderLeftColor: isError ? c.danger : c.success }]}>
              <Text style={[styles.info, { color: isError ? c.danger : c.success }]}>{info}</Text>
            </View>
          )}
        </ScrollView>
      </View>

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
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.hero },

    hero: { paddingTop: 78, paddingHorizontal: 28, paddingBottom: 54 },
    heroKicker: { color: 'rgba(255,255,255,0.72)', fontSize: 13, fontWeight: '800', letterSpacing: 2.5, marginBottom: 14 },
    heroTitle: { color: '#ffffff', fontSize: 30, fontWeight: '800', lineHeight: 38 },

    sheet: { flex: 1, backgroundColor: c.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: -30 },
    sheetContent: { paddingHorizontal: 26, paddingTop: 26, paddingBottom: 40 },

    tabs: { flexDirection: 'row' },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: c.border },
    tabActive: { borderBottomColor: c.primary },
    tabText: { fontSize: 15, fontWeight: '700', color: c.textMuted },
    tabTextActive: { color: c.primary },

    welcome: { fontSize: 18, fontWeight: '700', color: c.heading, marginTop: 24, marginBottom: 2 },

    fieldWrap: { marginTop: 18 },
    fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: c.textMuted, marginBottom: 2 },
    fieldInput: { borderBottomWidth: 1.5, borderBottomColor: c.border, paddingVertical: 10, fontSize: 17, color: c.text },
    fieldInputFocused: { borderBottomColor: c.primary },

    forgotWrap: { alignSelf: 'flex-end', marginTop: 14 },
    forgot: { color: c.primary, fontSize: 13, fontWeight: '600' },

    button: {
      backgroundColor: c.primary, borderRadius: 30, paddingVertical: 17, alignItems: 'center', marginTop: 26,
      shadowColor: c.primary, shadowOpacity: 0.32, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: c.onPrimary, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

    infoBox: { backgroundColor: c.inputBg, borderLeftWidth: 3, borderRadius: 8, paddingVertical: 11, paddingHorizontal: 14, marginTop: 18 },
    info: { fontSize: 14, lineHeight: 19 },

    acceptRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 18 },
    checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: c.border, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1 },
    checkboxOn: { backgroundColor: c.primary, borderColor: c.primary },
    checkmark: { color: c.onPrimary, fontSize: 15, fontWeight: '800' },
    acceptText: { flex: 1, fontSize: 13, color: c.textMuted, lineHeight: 19 },
    acceptLink: { color: c.primary, fontWeight: '700' },

    modalRoot: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 24 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: c.heading, marginBottom: 14 },
    modalClose: { textAlign: 'center', color: c.textMuted, fontSize: 14 },
  });
}
