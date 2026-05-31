// Login- und Registrierungs-Screen (themed).
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useColors, Colors } from '../contexts/ThemeContext';

function translateError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-Mail oder Passwort ist falsch.';
  if (m.includes('already registered')) return 'Diese E-Mail ist bereits registriert. Bitte logge dich ein.';
  if (m.includes('password should be at least')) return 'Das Passwort muss mindestens 6 Zeichen haben.';
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

  function show(message: string, error: boolean) { setInfo(message); setIsError(error); }

  async function handleSubmit() {
    setInfo(null);
    if (!email || !password) { show('Bitte E-Mail und Passwort eingeben.', true); return; }
    setLoading(true);
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) show(translateError(error.message), true);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) show(translateError(error.message), true);
      else if (!data.session) { show('Fast geschafft! Bitte bestätige deine E-Mail und logge dich dann ein.', false); setMode('login'); }
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.logo}>FitFusion</Text>
        <Text style={styles.subtitle}>{mode === 'login' ? 'Willkommen zurück 👋' : 'Konto erstellen'}</Text>

        <Text style={styles.label}>E-Mail</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="du@beispiel.de" placeholderTextColor={c.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" inputMode="email" />

        <Text style={styles.label}>Passwort</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="mindestens 6 Zeichen" placeholderTextColor={c.textMuted} secureTextEntry autoCapitalize="none" />

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.buttonText}>{mode === 'login' ? 'Einloggen' : 'Registrieren'}</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setInfo(null); }}>
          <Text style={styles.toggle}>{mode === 'login' ? 'Noch kein Konto? Jetzt registrieren' : 'Schon ein Konto? Zum Login'}</Text>
        </TouchableOpacity>

        {info && <Text style={[styles.info, { color: isError ? c.danger : c.success }]}>{info}</Text>}
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, justifyContent: 'center', padding: 20 },
    card: { backgroundColor: c.card, borderRadius: 16, padding: 24, maxWidth: 420, width: '100%', alignSelf: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    logo: { fontSize: 34, fontWeight: 'bold', color: c.heading, textAlign: 'center' },
    subtitle: { fontSize: 16, color: c.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 20 },
    label: { fontSize: 13, color: c.text, marginBottom: 6, marginTop: 10, fontWeight: '600' },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: c.inputBg, color: c.text },
    button: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 22 },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
    toggle: { color: c.primary, textAlign: 'center', marginTop: 18, fontSize: 14 },
    info: { marginTop: 16, fontSize: 14, textAlign: 'center' },
  });
}
