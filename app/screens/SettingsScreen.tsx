// Einstellungen: Profil-Unterseite, Dark-Mode-Schalter, Abmelden und übliche App-Einstellungen.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, useColors, Colors } from '../contexts/ThemeContext';
import ProfileScreen from './ProfileScreen';
import LegalText from '../components/LegalText';
import { PRIVACY_SECTIONS, IMPRESSUM_SECTIONS } from '../lib/legal';
import { exportUserData, deleteAccount } from '../lib/gdpr';
import { loadReminderPrefs, saveReminderPrefs, applyReminders, ensurePermission, ReminderPrefs } from '../lib/reminders';
import { useFocusTick } from '../lib/useFocusTick';

// Unterer Abstand fuer Scroll-Inhalte: auf Android (Edge-to-Edge) deutlich groesser,
// damit der letzte Text auf keinem Geraet hinter der System-/Navigationsleiste landet.
const BOTTOM_PAD = Platform.OS === 'android' ? 120 : 48;

export default function SettingsScreen({ focusTick }: { focusTick?: number }) {
  const { session, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const c = useColors();
  const styles = makeStyles(c);

  const [view, setView] = useState<'menu' | 'profile' | 'legal' | 'privacy' | 'impressum'>('menu');
  const [rem, setRem] = useState<ReminderPrefs | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgErr, setMsgErr] = useState(false);
  const [busy, setBusy] = useState(false);

  function showMsg(text: string, err: boolean) { setMsg(text); setMsgErr(err); }

  useEffect(() => {
    loadReminderPrefs().then(setRem);
  }, []);

  // Reiter erneut angetippt -> zurueck zum Einstellungs-Menue
  useFocusTick(focusTick, () => setView('menu'));
  async function updateRem(next: ReminderPrefs) {
    if (next.enabled && !rem?.enabled) {
      const ok = await ensurePermission();
      if (!ok) { showMsg('Bitte Benachrichtigungen für die App erlauben (Handy-Einstellungen).', true); next = { ...next, enabled: false }; }
    }
    setRem(next);
    await saveReminderPrefs(next);
    await applyReminders(next);
  }

  async function resetPassword() {
    if (!session?.user?.email) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.resetPasswordForEmail(session.user.email);
    setBusy(false);
    showMsg(error ? 'Fehler: ' + error.message : 'E-Mail zum Zurücksetzen wurde gesendet (Postfach prüfen).', !!error);
  }
  function confirmRedoOnboarding() {
    Alert.alert(
      'Onboarding erneut durchlaufen?',
      'Du gibst deine Profilangaben neu ein. Deine bisherigen Trainings- und Essensdaten bleiben erhalten.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Fortfahren', onPress: redoOnboarding },
      ],
    );
  }
  async function redoOnboarding() {
    if (!session?.user) return;
    // altes aktives Ziel deaktivieren, damit nicht mehrere aktive Ziele entstehen
    await supabase.from('goals').update({ is_active: false }).eq('user_id', session.user.id).eq('is_active', true);
    await supabase.from('profiles').update({ experience_level: null }).eq('id', session.user.id);
    await refreshProfile();
  }
  async function logout() {
    await supabase.auth.signOut();
  }

  // DSGVO: Datenexport (Auskunft/Portabilität) als JSON-Datei teilen
  async function exportData() {
    const uid = session?.user?.id;
    if (!uid) return;
    setBusy(true); setMsg(null);
    try {
      const data = await exportUserData(uid);
      const json = JSON.stringify(data, null, 2);
      const uri = FileSystem.documentDirectory + 'fitavo-datenexport.json';
      await FileSystem.writeAsStringAsync(uri, json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'FitAvo Datenexport' });
      } else {
        showMsg('Teilen ist auf diesem Gerät nicht verfügbar.', true);
      }
    } catch (e: any) {
      showMsg('Export fehlgeschlagen: ' + (e?.message ?? ''), true);
    } finally {
      setBusy(false);
    }
  }

  // DSGVO: Konto & alle Daten löschen (Recht auf Löschung)
  function confirmDeleteAccount() {
    Alert.alert(
      'Konto & alle Daten löschen?',
      'Dadurch werden ALLE deine Daten (Profil, Training, Ernährung, Fortschritt) unwiderruflich gelöscht. Dieser Schritt kann nicht rückgängig gemacht werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Endgültig löschen', style: 'destructive', onPress: doDeleteAccount },
      ],
    );
  }
  async function doDeleteAccount() {
    const uid = session?.user?.id;
    if (!uid) return;
    setBusy(true); setMsg(null);
    try {
      const res = await deleteAccount(uid);
      if (res.serverDeleted || res.dataDeleted) {
        await supabase.auth.signOut(); // beendet die Sitzung -> zurück zum Login
      } else {
        setBusy(false);
        showMsg('Löschung fehlgeschlagen (' + res.failed.join(', ') + '). Bitte erneut versuchen.', true);
      }
    } catch (e: any) {
      setBusy(false);
      showMsg('Löschung fehlgeschlagen: ' + (e?.message ?? ''), true);
    }
  }

  // Unterseite: Profil bearbeiten
  if (view === 'profile') {
    return <ProfileScreen onBack={() => setView('menu')} />;
  }

  // Unterseite: Rechtliches
  if (view === 'legal') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: BOTTOM_PAD }}>
        <TouchableOpacity onPress={() => setView('menu')}><Text style={styles.link}>‹ Zurück</Text></TouchableOpacity>
        <Text style={[styles.title, { marginTop: 10 }]}>Rechtliches</Text>
        <View style={[styles.card, { padding: 16 }]}>
          <LegalText c={c} />
        </View>
        <Text style={styles.hint}>Stand: Vorlage. Vor einer Veröffentlichung anwaltlich prüfen. Impressum & Datenschutzerklärung findest du separat in den Einstellungen.</Text>
      </ScrollView>
    );
  }

  // Unterseite: Datenschutzerklärung
  if (view === 'privacy') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: BOTTOM_PAD }}>
        <TouchableOpacity onPress={() => setView('menu')}><Text style={styles.link}>‹ Zurück</Text></TouchableOpacity>
        <Text style={[styles.title, { marginTop: 10 }]}>Datenschutzerklärung</Text>
        <View style={[styles.card, { padding: 16 }]}>
          <LegalText c={c} sections={PRIVACY_SECTIONS} />
        </View>
        <Text style={styles.hint}>Vorlage – Platzhalter [...] ausfüllen und vor Veröffentlichung anwaltlich prüfen (zusätzlich Impressum & AVV mit Supabase).</Text>
      </ScrollView>
    );
  }

  // Unterseite: Impressum
  if (view === 'impressum') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: BOTTOM_PAD }}>
        <TouchableOpacity onPress={() => setView('menu')}><Text style={styles.link}>‹ Zurück</Text></TouchableOpacity>
        <Text style={[styles.title, { marginTop: 10 }]}>Impressum</Text>
        <View style={[styles.card, { padding: 16 }]}>
          <LegalText c={c} sections={IMPRESSUM_SECTIONS} />
        </View>
        <Text style={styles.hint}>Vorlage nach § 5 DDG – Platzhalter [...] mit deinen Angaben (ladungsfähige Anschrift) ausfüllen und vor Veröffentlichung prüfen lassen.</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: BOTTOM_PAD }}>
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

      <Text style={styles.section}>ERINNERUNGEN</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>🔔  Erinnerungen aktiv</Text>
          <Switch value={!!rem?.enabled} onValueChange={(v) => { if (rem) updateRem({ ...rem, enabled: v }); }} />
        </View>
        {rem?.enabled && (
          <>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>💧  Wasser trinken</Text>
              <Switch value={rem.water} onValueChange={(v) => updateRem({ ...rem, water: v })} />
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>💪  Training</Text>
              <Switch value={rem.training} onValueChange={(v) => updateRem({ ...rem, training: v })} />
            </View>
            {rem.training && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Trainingszeit</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => updateRem({ ...rem, trainingHour: Math.max(5, rem.trainingHour - 1) })}><Text style={styles.stepBtnText}>−</Text></TouchableOpacity>
                  <Text style={styles.stepVal}>{String(rem.trainingHour).padStart(2, '0')}:00</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => updateRem({ ...rem, trainingHour: Math.min(22, rem.trainingHour + 1) })}><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
                </View>
              </View>
            )}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>💬  Tägliche Motivation</Text>
              <Switch value={!!rem?.motivation} onValueChange={(v) => { if (rem) updateRem({ ...rem, motivation: v }); }} />
            </View>
            {rem.motivation && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Motivations-Uhrzeit</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => updateRem({ ...rem, motivationHour: Math.max(5, rem.motivationHour - 1) })}><Text style={styles.stepBtnText}>−</Text></TouchableOpacity>
                  <Text style={styles.stepVal}>{String(rem.motivationHour).padStart(2, '0')}:00</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => updateRem({ ...rem, motivationHour: Math.min(22, rem.motivationHour + 1) })}><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}
        <Text style={styles.hint}>💬 Über 100 Motivationssprüche, 1× täglich zur gewählten Zeit. Wasser: 10/13/16/19 Uhr · Training zur gewählten Zeit. Echte Benachrichtigungen erscheinen erst nach einem Development-Build (in Expo Go nicht).</Text>
      </View>

      <Text style={styles.section}>DATEN</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.linkRow} onPress={confirmRedoOnboarding}>
          <Text style={styles.link}>Onboarding erneut durchlaufen</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.section}>DATENSCHUTZ (DSGVO)</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.linkRow} onPress={exportData} disabled={busy}>
          <Text style={styles.link}>📤  Meine Daten exportieren</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => setView('privacy')}>
          <Text style={styles.link}>🔒  Datenschutzerklärung</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={confirmDeleteAccount} disabled={busy}>
          <Text style={[styles.link, { color: c.danger }]}>🗑  Konto & alle Daten löschen</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.section}>RECHTLICHES</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.linkRow} onPress={() => setView('legal')}>
          <Text style={styles.link}>📄  Haftungsausschluss & Gesundheitshinweis</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => setView('impressum')}>
          <Text style={styles.link}>🏛  Impressum</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.section}>ÜBER</Text>
      <View style={styles.card}>
        <View style={styles.row}><Text style={styles.rowLabel}>App</Text><Text style={styles.rowValue}>FitAvo</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Version</Text><Text style={styles.rowValue}>1.0.0</Text></View>
      </View>

      {busy && <ActivityIndicator color={c.primary} style={{ marginTop: 14 }} />}
      {msg && <Text style={[styles.msg, { color: msgErr ? c.danger : c.success }]}>{msg}</Text>}

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Abmelden</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 56, paddingHorizontal: 16 },
    title: { fontSize: 26, fontWeight: '800', color: c.heading, marginBottom: 16 },
    section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, color: c.textMuted, marginTop: 14, marginBottom: 8, marginLeft: 4 },
    card: { backgroundColor: c.card, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    rowLabel: { fontSize: 16, color: c.text, flex: 1 },
    rowValue: { fontSize: 15, color: c.textMuted, marginLeft: 12, maxWidth: '60%' },
    linkRow: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    link: { fontSize: 16, color: c.primary, fontWeight: '600' },
    hint: { fontSize: 12, color: c.textMuted, paddingHorizontal: 16, paddingVertical: 10 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stepBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    stepBtnText: { fontSize: 18, color: c.primary, fontWeight: '700' },
    stepVal: { fontSize: 15, color: c.heading, fontWeight: '700', minWidth: 48, textAlign: 'center' },
    msg: { color: c.success, textAlign: 'center', marginTop: 14, fontSize: 14 },
    logoutBtn: { marginTop: 24, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: c.danger },
    logoutText: { color: c.danger, fontSize: 16, fontWeight: '700' },
  });
}
