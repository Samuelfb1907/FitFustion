// Einstellungen: Profil-Unterseite, Dark-Mode-Schalter, Abmelden und übliche App-Einstellungen.
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, useColors, Colors } from '../contexts/ThemeContext';
import ProfileScreen from './ProfileScreen';

const NOTIF_KEY = 'fitfusion.notif';

export default function SettingsScreen() {
  const { session, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const c = useColors();
  const styles = makeStyles(c);

  const [view, setView] = useState<'menu' | 'profile'>('menu');
  const [notif, setNotif] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_KEY).then((v) => setNotif(v === '1'));
  }, []);
  function toggleNotif(v: boolean) {
    setNotif(v);
    AsyncStorage.setItem(NOTIF_KEY, v ? '1' : '0').catch(() => {});
  }

  async function resetPassword() {
    if (!session?.user?.email) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.resetPasswordForEmail(session.user.email);
    setBusy(false);
    setMsg(error ? 'Fehler: ' + error.message : 'E-Mail zum Zurücksetzen wurde gesendet (Postfach prüfen).');
  }
  async function redoOnboarding() {
    if (!session?.user) return;
    await supabase.from('profiles').update({ experience_level: null }).eq('id', session.user.id);
    await refreshProfile();
  }
  async function logout() {
    await supabase.auth.signOut();
  }

  // Unterseite: Profil bearbeiten
  if (view === 'profile') {
    return <ProfileScreen onBack={() => setView('menu')} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Einstellungen</Text>

      <Text style={styles.section}>KONTO</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.linkRow} onPress={() => setView('profile')}>
          <Text style={styles.link}>👤  Profil bearbeiten</Text>
        </TouchableOpacity>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>E-Mail</Text>
          <Text style={styles.rowValue} numberOfLines={1}>{session?.user?.email}</Text>
        </View>
        <TouchableOpacity style={styles.linkRow} onPress={resetPassword} disabled={busy}>
          <Text style={styles.link}>Passwort zurücksetzen</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.section}>DARSTELLUNG</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>🌙  Dunkler Modus</Text>
          <Switch value={theme === 'dark'} onValueChange={toggleTheme} />
        </View>
      </View>

      <Text style={styles.section}>BENACHRICHTIGUNGEN</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>🔔  Push-Erinnerungen</Text>
          <Switch value={notif} onValueChange={toggleNotif} />
        </View>
        <Text style={styles.hint}>Trainings-Erinnerungen (Funktion folgt – Einstellung wird gespeichert).</Text>
      </View>

      <Text style={styles.section}>DATEN</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.linkRow} onPress={redoOnboarding}>
          <Text style={styles.link}>Onboarding erneut durchlaufen</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.section}>ÜBER</Text>
      <View style={styles.card}>
        <View style={styles.row}><Text style={styles.rowLabel}>App</Text><Text style={styles.rowValue}>FitFusion</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Version</Text><Text style={styles.rowValue}>1.0.0</Text></View>
      </View>

      {busy && <ActivityIndicator color={c.primary} style={{ marginTop: 14 }} />}
      {msg && <Text style={styles.msg}>{msg}</Text>}

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Abmelden</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 60, paddingHorizontal: 20 },
    title: { fontSize: 26, fontWeight: 'bold', color: c.heading, marginBottom: 16 },
    section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, color: c.textMuted, marginTop: 14, marginBottom: 8, marginLeft: 4 },
    card: { backgroundColor: c.card, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    rowLabel: { fontSize: 16, color: c.text, flex: 1 },
    rowValue: { fontSize: 15, color: c.textMuted, marginLeft: 12, maxWidth: '60%' },
    linkRow: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    link: { fontSize: 16, color: c.primary, fontWeight: '600' },
    hint: { fontSize: 12, color: c.textMuted, paddingHorizontal: 16, paddingVertical: 10 },
    msg: { color: c.success, textAlign: 'center', marginTop: 14, fontSize: 14 },
    logoutBtn: { marginTop: 24, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: c.danger },
    logoutText: { color: c.danger, fontSize: 16, fontWeight: '700' },
  });
}
