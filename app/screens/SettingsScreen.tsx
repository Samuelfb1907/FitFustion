// Einstellungen: Profil-Unterseite, Dark-Mode-Schalter, Abmelden und übliche App-Einstellungen.
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, useColors, Colors } from '../contexts/ThemeContext';
import { useT, useLang } from '../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import ProfileScreen from './ProfileScreen';
import LegalText from '../components/LegalText';
import { getPrivacySections, getImprintSections, getTermsSections, getDisclaimerSections } from '../lib/legal';
import { exportUserData, deleteAccount } from '../lib/gdpr';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadReminderPrefs, saveReminderPrefs, applyReminders, ensurePermission, ReminderPrefs } from '../lib/reminders';
import { useFocusTick } from '../lib/useFocusTick';
import { healthSupported, healthAvailable, hasStepsPermission, requestHealthPermission, openHealthSettings } from '../lib/health';
import BackButton from '../components/BackButton';
import SwipeBack from '../components/SwipeBack';
import GlassFill from '../components/GlassFill';
import Segmented from '../components/Segmented';
import { TAB_BAR_SPACE } from '../lib/layout';

// Unterer Abstand fuer Scroll-Inhalte: GROSSZUEGIG (Platz der Pille + extra), damit der
// Abmelden-Button klar ueber der schwebenden Glas-Pille endet und man bequem dorthin scrollt.
const BOTTOM_PAD = TAB_BAR_SPACE + 72;

export default function SettingsScreen({ focusTick }: { focusTick?: number }) {
  const { session, refreshProfile } = useAuth();
  const { mode, setMode } = useTheme();
  const t = useT();
  const { lang, setLang } = useLang();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [view, setView] = useState<'menu' | 'profile' | 'legal' | 'privacy' | 'impressum' | 'terms' | 'password'>('menu');
  const [rem, setRem] = useState<ReminderPrefs | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgErr, setMsgErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stepsConnected, setStepsConnected] = useState(false);
  // In-App-Passwortaenderung
  const [pwCur, setPwCur] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwNew2, setPwNew2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState(false);

  function showMsg(text: string, err: boolean) { setMsg(text); setMsgErr(err); }

  useEffect(() => {
    loadReminderPrefs().then(setRem);
  }, []);

  useEffect(() => {
    if (healthSupported()) hasStepsPermission().then(setStepsConnected).catch(() => {});
  }, []);

  // Sprachwechsel: eine evtl. noch sichtbare Status-Meldung war in der ALTEN Sprache
  // formuliert (sie wird als fertiger Text gespeichert) -> verwerfen, damit unten nichts
  // in der falschen Sprache stehenbleibt.
  useEffect(() => { setMsg(null); setPwMsg(null); }, [lang]);

  function connectHealth() {
    if (Platform.OS === 'ios') {
      // iOS: eingebauter Schrittzaehler ("Bewegung & Fitness") - direkte Berechtigungsabfrage.
      Alert.alert(
        t('settings.health.ios.alert.connectTitle'),
        t('settings.health.ios.alert.connectBody'),
        [
          { text: t('settings.btn.cancel'), style: 'cancel' },
          { text: t('settings.btn.connect'), onPress: doConnectHealth },
        ],
      );
      return;
    }
    // Android: Pflicht-Hinweis (Google) VOR der Berechtigungsabfrage: was wird gelesen + wohin.
    Alert.alert(
      t('settings.health.alert.connectTitle'),
      t('settings.health.alert.connectBody'),
      [
        { text: t('settings.btn.cancel'), style: 'cancel' },
        { text: t('settings.btn.connect'), onPress: doConnectHealth },
      ],
    );
  }
  async function doConnectHealth() {
    setBusy(true); setMsg(null);
    const available = await healthAvailable();
    if (!available) {
      setBusy(false);
      if (Platform.OS === 'ios') {
        showMsg(t('settings.health.ios.unavailable'), true);
        return;
      }
      Alert.alert(
        t('settings.health.alert.neededTitle'),
        t('settings.health.alert.neededBody'),
        [
          { text: t('settings.btn.cancel'), style: 'cancel' },
          { text: t('settings.btn.open'), onPress: () => { openHealthSettings(); } },
        ],
      );
      return;
    }
    const ok = await requestHealthPermission();
    setBusy(false);
    setStepsConnected(ok);
    if (Platform.OS === 'ios') {
      showMsg(ok ? t('settings.health.ios.connected') : t('settings.health.ios.denied'), !ok);
    } else {
      showMsg(ok ? t('settings.health.connected') : t('settings.health.noPermission'), !ok);
    }
  }

  // Reiter erneut angetippt -> zurueck zum Einstellungs-Menue
  useFocusTick(focusTick, () => { setView('menu'); setMsg(null); });
  async function updateRem(next: ReminderPrefs) {
    if (next.enabled && !rem?.enabled) {
      const ok = await ensurePermission();
      if (!ok) { showMsg(t('settings.rem.permissionNeeded'), true); next = { ...next, enabled: false }; }
    }
    setRem(next);
    await saveReminderPrefs(next);
    await applyReminders(next);
  }

  // In-App-Passwortaenderung: aktuelles Passwort verifizieren -> neues setzen.
  async function changePassword() {
    const email = session?.user?.email;
    if (!email) return;
    if (pwNew.length < 8) { setPwMsg(t('settings.pw.minLength')); setPwErr(true); return; }
    if (pwNew !== pwNew2) { setPwMsg(t('settings.pw.mismatch')); setPwErr(true); return; }
    setPwBusy(true); setPwMsg(null);
    // 1) aktuelles Passwort pruefen (Re-Auth), damit nicht ein offenes Handy reicht
    const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: pwCur });
    if (signErr) { setPwBusy(false); setPwMsg(t('settings.pw.wrongCurrent')); setPwErr(true); return; }
    // 2) neues Passwort setzen
    const { error: upErr } = await supabase.auth.updateUser({ password: pwNew });
    setPwBusy(false);
    if (upErr) { setPwMsg(t('settings.pw.changeFailed', { msg: upErr.message })); setPwErr(true); return; }
    setPwCur(''); setPwNew(''); setPwNew2('');
    setPwMsg(t('settings.pw.changed')); setPwErr(false);
  }
  function confirmRedoOnboarding() {
    Alert.alert(
      t('settings.data.redoTitle'),
      t('settings.data.redoBody'),
      [
        { text: t('settings.btn.cancel'), style: 'cancel' },
        { text: t('settings.btn.continue'), onPress: redoOnboarding },
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
        await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: t('settings.privacy.exportDialogTitle') });
      } else {
        showMsg(t('settings.privacy.shareUnavailable'), true);
      }
    } catch (e: any) {
      showMsg(t('settings.privacy.exportFailed', { msg: e?.message ?? '' }), true);
    } finally {
      setBusy(false);
    }
  }

  // DSGVO: KI-Einwilligung (Art. 9) widerrufen - vor erneuter Nutzung wird wieder gefragt.
  async function revokeAiConsent() {
    const uid = session?.user?.id;
    try { await AsyncStorage.removeItem('fitavo.aiConsentAt'); } catch {}
    if (uid) supabase.from('profiles').update({ ai_consent_at: null }).eq('id', uid).then(() => {}, () => {});
    Alert.alert(t('settings.privacy.revokeAiTitle'), t('settings.privacy.revokeAiBody'));
  }

  // DSGVO: Konto & alle Daten löschen (Recht auf Löschung)
  function confirmDeleteAccount() {
    Alert.alert(
      t('settings.privacy.deleteTitle'),
      t('settings.privacy.deleteBody'),
      [
        { text: t('settings.btn.cancel'), style: 'cancel' },
        { text: t('settings.btn.deleteForever'), style: 'destructive', onPress: doDeleteAccount },
      ],
    );
  }
  async function doDeleteAccount() {
    const uid = session?.user?.id;
    if (!uid) return;
    setBusy(true); setMsg(null);
    try {
      const res = await deleteAccount(uid);
      if (res.serverDeleted) {
        await supabase.auth.signOut(); // Konto + Daten entfernt -> zurück zum Login
      } else if (res.dataDeleted) {
        // Daten geloescht, aber das Auth-Konto konnte serverseitig nicht entfernt werden:
        // ehrlich kommunizieren statt vollstaendige Loeschung vorzutaeuschen.
        Alert.alert(
          t('settings.privacy.dataDeletedTitle'),
          t('settings.privacy.dataDeletedBody'),
          [{ text: t('settings.btn.ok'), onPress: () => supabase.auth.signOut() }],
        );
      } else {
        setBusy(false);
        showMsg(t('settings.privacy.deleteFailedDetail', { reason: res.failed.join(', ') }), true);
      }
    } catch (e: any) {
      setBusy(false);
      showMsg(t('settings.privacy.deleteFailed', { msg: e?.message ?? '' }), true);
    }
  }

  // Unterseite: Profil bearbeiten
  if (view === 'profile') {
    return (
      <SwipeBack onBack={() => setView('menu')} c={c} behind={renderMenu()}>
        <ProfileScreen onBack={() => setView('menu')} />
      </SwipeBack>
    );
  }

  // Unterseite: Passwort ändern (in-app, mit Verifizierung des aktuellen Passworts)
  if (view === 'password') {
    return (
      <SwipeBack onBack={() => setView('menu')} c={c} behind={renderMenu()}>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: BOTTOM_PAD }} keyboardShouldPersistTaps="handled">
          <BackButton onPress={() => setView('menu')} c={c} />
          <Text style={[styles.title, { marginTop: 10 }]}>{t('settings.pw.title')}</Text>
          <View style={[styles.card, { padding: 16 }]}>
            <GlassFill radius={20} />
            <Text style={styles.pwLabel}>{t('settings.pw.current')}</Text>
            <TextInput style={styles.pwInput} value={pwCur} onChangeText={setPwCur} secureTextEntry autoCapitalize="none" placeholder={t('settings.pw.current')} placeholderTextColor={c.textMuted} />
            <Text style={styles.pwLabel}>{t('settings.pw.new')}</Text>
            <TextInput style={styles.pwInput} value={pwNew} onChangeText={setPwNew} secureTextEntry autoCapitalize="none" placeholder={t('settings.pw.minHint')} placeholderTextColor={c.textMuted} />
            <Text style={styles.pwLabel}>{t('settings.pw.repeat')}</Text>
            <TextInput style={styles.pwInput} value={pwNew2} onChangeText={setPwNew2} secureTextEntry autoCapitalize="none" placeholder={t('settings.pw.repeatPlaceholder')} placeholderTextColor={c.textMuted} returnKeyType="done" onSubmitEditing={changePassword} />
            <TouchableOpacity style={[styles.pwBtn, pwBusy && { opacity: 0.6 }]} onPress={changePassword} disabled={pwBusy} activeOpacity={0.85}>
              {pwBusy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.pwBtnText}>{t('settings.pw.title')}</Text>}
            </TouchableOpacity>
            {pwMsg && <Text style={[styles.msg, { color: pwErr ? c.danger : c.success, marginTop: 12 }]}>{pwMsg}</Text>}
          </View>
          <Text style={styles.hint}>{t('settings.pw.forgotHint')}</Text>
        </ScrollView>
      </SwipeBack>
    );
  }

  // Unterseite: Rechtliches
  if (view === 'legal') {
    return (
      <SwipeBack onBack={() => setView('menu')} c={c} behind={renderMenu()}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: BOTTOM_PAD }}>
        <BackButton onPress={() => setView('menu')} c={c} />
        <Text style={[styles.title, { marginTop: 10 }]}>{t('settings.legal.disclaimerTitle')}</Text>
        <View style={[styles.card, { padding: 16 }]}>
          <GlassFill radius={20} />
          <LegalText c={c} sections={getDisclaimerSections(lang)} />
        </View>
        <Text style={styles.hint}>{t('settings.legal.disclaimerHint')}</Text>
      </ScrollView>
      </SwipeBack>
    );
  }

  // Unterseite: Datenschutzerklärung
  if (view === 'privacy') {
    return (
      <SwipeBack onBack={() => setView('menu')} c={c} behind={renderMenu()}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: BOTTOM_PAD }}>
        <BackButton onPress={() => setView('menu')} c={c} />
        <Text style={[styles.title, { marginTop: 10 }]}>{t('settings.legal.privacyTitle')}</Text>
        <View style={[styles.card, { padding: 16 }]}>
          <GlassFill radius={20} />
          <LegalText c={c} sections={getPrivacySections(lang)} />
        </View>
      </ScrollView>
      </SwipeBack>
    );
  }

  // Unterseite: Impressum
  if (view === 'impressum') {
    return (
      <SwipeBack onBack={() => setView('menu')} c={c} behind={renderMenu()}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: BOTTOM_PAD }}>
        <BackButton onPress={() => setView('menu')} c={c} />
        <Text style={[styles.title, { marginTop: 10 }]}>{t('settings.legal.imprintTitle')}</Text>
        <View style={[styles.card, { padding: 16 }]}>
          <GlassFill radius={20} />
          <LegalText c={c} sections={getImprintSections(lang)} />
        </View>
      </ScrollView>
      </SwipeBack>
    );
  }

  // Unterseite: Nutzungsbedingungen (AGB)
  if (view === 'terms') {
    return (
      <SwipeBack onBack={() => setView('menu')} c={c} behind={renderMenu()}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: BOTTOM_PAD }}>
        <BackButton onPress={() => setView('menu')} c={c} />
        <Text style={[styles.title, { marginTop: 10 }]}>{t('settings.legal.termsTitle')}</Text>
        <View style={[styles.card, { padding: 16 }]}>
          <GlassFill radius={20} />
          <LegalText c={c} sections={getTermsSections(lang)} />
        </View>
      </ScrollView>
      </SwipeBack>
    );
  }

  return renderMenu();

  function renderMenu() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: BOTTOM_PAD }}>
      <Text style={styles.title}>{t('settings.title')}</Text>

      <Text style={styles.section}>{t('settings.section.account')}</Text>
      <View style={styles.card}>
        <GlassFill radius={20} />
        <TouchableOpacity style={styles.linkRow} onPress={() => setView('profile')}>
          <Ionicons name="person" size={18} color={c.primary} />
          <Text style={styles.link}>{t('settings.menu.editProfile')}</Text>
        </TouchableOpacity>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('settings.menu.email')}</Text>
          <Text style={styles.rowValue} numberOfLines={1}>{session?.user?.email}</Text>
        </View>
        <TouchableOpacity style={styles.linkRow} onPress={() => { setPwMsg(null); setView('password'); }}>
          <Ionicons name="key" size={18} color={c.primary} />
          <Text style={styles.link}>{t('settings.menu.changePassword')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.section}>{t('settings.section.appearance')}</Text>
      <View style={styles.card}>
        <GlassFill radius={20} />
        <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 }}>
            <Ionicons name="moon" size={18} color={c.textMuted} />
            <Text style={{ fontSize: 16, color: c.text, lineHeight: 22 }}>{t('settings.appearance.title')}</Text>
          </View>
          <Segmented
            options={[{ key: 'system', label: t('settings.appearance.system') }, { key: 'light', label: t('settings.appearance.light') }, { key: 'dark', label: t('settings.appearance.dark') }]}
            value={mode}
            onChange={(k) => setMode(k as 'system' | 'light' | 'dark')}
            c={c}
          />
          {mode === 'system' && (
            <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 16, marginTop: 8 }}>
              {t('settings.appearance.systemHint')}
            </Text>
          )}
        </View>
      </View>

      <Text style={styles.section}>{t('settings.section.language')}</Text>
      <View style={styles.card}>
        <GlassFill radius={20} />
        <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 }}>
            <Ionicons name="globe-outline" size={18} color={c.textMuted} />
            <Text style={{ fontSize: 16, color: c.text, lineHeight: 22 }}>{t('settings.language')}</Text>
          </View>
          <Segmented
            options={[{ key: 'de', label: 'Deutsch' }, { key: 'en', label: 'English' }]}
            value={lang}
            onChange={(k) => setLang(k as 'de' | 'en')}
            c={c}
          />
        </View>
      </View>

      <Text style={styles.section}>{t('settings.section.reminders')}</Text>
      <View style={styles.card}>
        <GlassFill radius={20} />
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="notifications" size={18} color={c.textMuted} />
            <Text style={styles.rowLabel}>{t('settings.rem.active')}</Text>
          </View>
          <Switch value={!!rem?.enabled} onValueChange={(v) => { if (rem) updateRem({ ...rem, enabled: v }); }} accessibilityLabel={t('settings.rem.active')} />
        </View>
        {rem?.enabled && (
          <>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="water" size={18} color={c.textMuted} />
                <Text style={styles.rowLabel}>{t('settings.rem.water')}</Text>
              </View>
              <Switch value={rem.water} onValueChange={(v) => updateRem({ ...rem, water: v })} accessibilityLabel={t('settings.rem.waterA11y')} />
            </View>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="barbell" size={18} color={c.textMuted} />
                <Text style={styles.rowLabel}>{t('settings.rem.training')}</Text>
              </View>
              <Switch value={rem.training} onValueChange={(v) => updateRem({ ...rem, training: v })} accessibilityLabel={t('settings.rem.trainingA11y')} />
            </View>
            {rem.training && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('settings.rem.trainingTime')}</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('settings.rem.trainingTimeEarlier')} onPress={() => updateRem({ ...rem, trainingHour: (rem.trainingHour + 23) % 24 })}><Text style={styles.stepBtnText}>−</Text></TouchableOpacity>
                  <Text style={styles.stepVal}>{String(rem.trainingHour).padStart(2, '0')}:00</Text>
                  <TouchableOpacity style={styles.stepBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('settings.rem.trainingTimeLater')} onPress={() => updateRem({ ...rem, trainingHour: (rem.trainingHour + 1) % 24 })}><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
                </View>
              </View>
            )}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="chatbubble-ellipses" size={18} color={c.textMuted} />
                <Text style={styles.rowLabel}>{t('settings.rem.motivation')}</Text>
              </View>
              <Switch value={!!rem?.motivation} onValueChange={(v) => { if (rem) updateRem({ ...rem, motivation: v }); }} accessibilityLabel={t('settings.rem.motivation')} />
            </View>
            {rem.motivation && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('settings.rem.motivationTime')}</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('settings.rem.motivationTimeEarlier')} onPress={() => updateRem({ ...rem, motivationHour: (rem.motivationHour + 23) % 24 })}><Text style={styles.stepBtnText}>−</Text></TouchableOpacity>
                  <Text style={styles.stepVal}>{String(rem.motivationHour).padStart(2, '0')}:00</Text>
                  <TouchableOpacity style={styles.stepBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('settings.rem.motivationTimeLater')} onPress={() => updateRem({ ...rem, motivationHour: (rem.motivationHour + 1) % 24 })}><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}
        <Text style={styles.hint}>{t('settings.rem.hint')}</Text>
      </View>

      {healthSupported() && (
        <>
          <Text style={styles.section}>{t('settings.section.health')}</Text>
          <View style={styles.card}>
            <GlassFill radius={20} />
            <TouchableOpacity style={styles.linkRow} onPress={connectHealth} disabled={busy}>
              <Ionicons name="walk" size={18} color={c.primary} />
              <Text style={styles.link}>{stepsConnected
                ? t(Platform.OS === 'ios' ? 'settings.health.ios.connectedLink' : 'settings.health.connectedLink')
                : t(Platform.OS === 'ios' ? 'settings.health.ios.connectLink' : 'settings.health.connectLink')}</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>{t(Platform.OS === 'ios' ? 'settings.health.ios.hint' : 'settings.health.hint')}</Text>
          </View>
        </>
      )}

      <Text style={styles.section}>{t('settings.section.data')}</Text>
      <View style={styles.card}>
        <GlassFill radius={20} />
        <TouchableOpacity style={styles.linkRow} onPress={confirmRedoOnboarding}>
          <Text style={styles.link}>{t('settings.data.redoLink')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.section}>{t('settings.section.privacy')}</Text>
      <View style={styles.card}>
        <GlassFill radius={20} />
        <TouchableOpacity style={styles.linkRow} onPress={exportData} disabled={busy}>
          <Ionicons name="share-outline" size={18} color={c.primary} />
          <Text style={styles.link}>{t('settings.privacy.exportLink')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => setView('privacy')}>
          <Ionicons name="lock-closed" size={18} color={c.primary} />
          <Text style={styles.link}>{t('settings.privacy.policyLink')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={revokeAiConsent}>
          <Ionicons name="sparkles" size={18} color={c.primary} />
          <Text style={styles.link}>{t('settings.privacy.revokeAiLink')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={confirmDeleteAccount} disabled={busy}>
          <Ionicons name="trash-outline" size={18} color={c.danger} />
          <Text style={[styles.link, { color: c.danger }]}>{t('settings.privacy.deleteLink')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.section}>{t('settings.section.legal')}</Text>
      <View style={styles.card}>
        <GlassFill radius={20} />
        <TouchableOpacity style={styles.linkRow} onPress={() => setView('legal')}>
          <Ionicons name="document-text" size={18} color={c.primary} />
          <Text style={styles.link}>{t('settings.legal.disclaimerLink')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => setView('impressum')}>
          <Ionicons name="business" size={18} color={c.primary} />
          <Text style={styles.link}>{t('settings.legal.imprintLink')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => setView('terms')}>
          <Ionicons name="reader" size={18} color={c.primary} />
          <Text style={styles.link}>{t('settings.legal.termsLink')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.section}>{t('settings.section.about')}</Text>
      <View style={styles.card}>
        <GlassFill radius={20} />
        <View style={styles.row}><Text style={styles.rowLabel}>{t('settings.about.app')}</Text><Text style={styles.rowValue}>FitAvo</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>{t('settings.about.version')}</Text><Text style={styles.rowValue}>1.0.0</Text></View>
      </View>

      {busy && <ActivityIndicator color={c.primary} style={{ marginTop: 14 }} />}
      {msg && <Text style={[styles.msg, { color: msgErr ? c.danger : c.success }]}>{msg}</Text>}

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out-outline" size={18} color={c.danger} />
        <Text style={styles.logoutText}>{t('settings.logout')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
  }
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent', paddingTop: 56, paddingHorizontal: 16 },
    title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, color: c.heading, marginBottom: 16 },
    section: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: c.textMuted, marginTop: 14, marginBottom: 8, marginLeft: 4 },
    card: { backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
    rowLabel: { fontSize: 16, color: c.text, flex: 1 },
    rowValue: { fontSize: 15, color: c.textMuted, marginLeft: 12, maxWidth: '60%' },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    link: { flex: 1, fontSize: 16, color: c.primary, fontWeight: '600' },
    hint: { fontSize: 12, color: c.textMuted, paddingHorizontal: 16, paddingVertical: 10 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stepBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    stepBtnText: { fontSize: 18, color: c.primary, fontWeight: '700' },
    stepVal: { fontSize: 15, color: c.heading, fontWeight: '700', minWidth: 48, textAlign: 'center' },
    msg: { color: c.success, textAlign: 'center', marginTop: 14, fontSize: 14 },
    pwLabel: { fontSize: 13, fontWeight: '600', color: c.text, marginTop: 12, marginBottom: 6 },
    pwInput: { borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: c.inputBg, color: c.text },
    pwBtn: { backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
    pwBtnText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
    logoutBtn: { marginTop: 24, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: c.danger },
    logoutText: { color: c.danger, fontSize: 16, fontWeight: '700' },
  });
}
