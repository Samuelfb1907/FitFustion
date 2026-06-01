// Login- und Registrierungs-Screen (themed, aufgehübscht).
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useColors, Colors } from '../contexts/ThemeContext';
import Segmented from '../components/Segmented';
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

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Marke */}
        <View style={styles.brand}>
          <View style={styles.logoBadge}><Text style={styles.logoEmoji}>🏋️</Text></View>
          <Text style={styles.logo}>FitFusion</Text>
          <Text style={styles.tagline}>Training, Ernährung & Fortschritt – alles an einem Ort.</Text>
        </View>

        {/* Karte */}
        <View style={styles.card}>
          <Segmented
            options={[{ key: 'login', label: 'Login' }, { key: 'register', label: 'Registrieren' }]}
            value={mode}
            onChange={(k) => { setMode(k as 'login' | 'register'); setInfo(null); }}
            c={c}
          />

          <Text style={styles.welcome}>{mode === 'login' ? 'Willkommen zurück 👋' : 'Konto erstellen'}</Text>

          <View style={[styles.field, focused === 'email' && styles.fieldFocused]}>
            <Text style={styles.fieldIcon}>📧</Text>
            <TextInput
              style={styles.fieldInput}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              placeholder="du@beispiel.de"
              placeholderTextColor={c.textMuted}
              autoCapitalize="none" autoCorrect={false} keyboardType="email-address" inputMode="email"
            />
          </View>

          <View style={[styles.field, focused === 'pw' && styles.fieldFocused]}>
            <Text style={styles.fieldIcon}>🔒</Text>
            <TextInput
              style={styles.fieldInput}
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

          <TouchableOpacity
            style={[styles.button, (loading || (mode === 'register' && !accepted)) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading || (mode === 'register' && !accepted)}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.buttonText}>{mode === 'login' ? 'Einloggen' : 'Konto erstellen'}</Text>}
          </TouchableOpacity>

          {info && (
            <View style={[styles.infoBox, { borderLeftColor: isError ? c.danger : c.success }]}>
              <Text style={[styles.info, { color: isError ? c.danger : c.success }]}>{info}</Text>
            </View>
          )}
        </View>

        <Text style={styles.footerHint}>
          {mode === 'login' ? 'Noch kein Konto? Tippe oben auf „Registrieren".' : 'Schon ein Konto? Tippe oben auf „Login".'}
        </Text>
      </ScrollView>

      <Modal visible={showLegal} animationType="slide" onRequestClose={() => setShowLegal(false)}>
        <View style={styles.modalRoot}>
          <Text style={styles.modalTitle}>Haftungsausschluss & Gesundheitshinweis</Text>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <LegalText c={c} />
          </ScrollView>
          <TouchableOpacity style={styles.button} onPress={() => { setAccepted(true); setShowLegal(false); }} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Gelesen & akzeptieren</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowLegal(false)}>
            <Text style={styles.footerHint}>Schließen</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 40 },

    brand: { alignItems: 'center', marginBottom: 26 },
    logoBadge: {
      width: 76, height: 76, borderRadius: 38, backgroundColor: c.primary,
      alignItems: 'center', justifyContent: 'center', marginBottom: 16,
      shadowColor: c.primary, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6,
    },
    logoEmoji: { fontSize: 36 },
    logo: { fontSize: 32, fontWeight: '800', color: c.heading, letterSpacing: 0.3 },
    tagline: { fontSize: 14, color: c.textMuted, marginTop: 8, textAlign: 'center', maxWidth: 300, lineHeight: 20 },

    card: {
      backgroundColor: c.card, borderRadius: 20, padding: 22, width: '100%', maxWidth: 440, alignSelf: 'center',
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
      shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4,
    },
    welcome: { fontSize: 16, fontWeight: '700', color: c.heading, textAlign: 'center', marginTop: 18, marginBottom: 4 },

    field: {
      flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: c.border, borderRadius: 12,
      backgroundColor: c.inputBg, paddingHorizontal: 14, marginTop: 12,
    },
    fieldFocused: { borderColor: c.primary },
    fieldIcon: { fontSize: 16, marginRight: 10 },
    fieldInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: c.text },

    forgotWrap: { alignSelf: 'flex-end', marginTop: 10 },
    forgot: { color: c.primary, fontSize: 13, fontWeight: '600' },

    button: {
      backgroundColor: c.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 20,
      shadowColor: c.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: c.onPrimary, fontSize: 16, fontWeight: '800' },

    infoBox: { backgroundColor: c.inputBg, borderLeftWidth: 3, borderRadius: 8, paddingVertical: 11, paddingHorizontal: 14, marginTop: 16 },
    info: { fontSize: 14, lineHeight: 19 },

    footerHint: { textAlign: 'center', color: c.textMuted, fontSize: 13, marginTop: 18 },

    acceptRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 16 },
    checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: c.border, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1 },
    checkboxOn: { backgroundColor: c.primary, borderColor: c.primary },
    checkmark: { color: c.onPrimary, fontSize: 15, fontWeight: '800' },
    acceptText: { flex: 1, fontSize: 13, color: c.textMuted, lineHeight: 19 },
    acceptLink: { color: c.primary, fontWeight: '700' },

    modalRoot: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 24 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: c.heading, marginBottom: 14 },
  });
}
