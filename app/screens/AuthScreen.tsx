// Login-/Registrierungs-Screen – Clean-Light, mit dezentem Smaragd-Hintergrund (Ambient).
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT, useLang } from '../contexts/LanguageContext';
import LegalText from '../components/LegalText';
import { DISCLAIMER_VERSION, getTermsSections, getPrivacySections, getDisclaimerSections } from '../lib/legal';
import Ambient from '../components/Ambient';
import GlassFill from '../components/GlassFill';

function translateError(msg: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return t('auth.err.invalidCredentials');
  if (m.includes('already registered')) return t('auth.err.alreadyRegistered');
  if (m.includes('password should be at least')) return t('auth.err.passwordTooShort');
  if (m.includes('invalid email') || m.includes('unable to validate email')) return t('auth.err.invalidEmail');
  if (m.includes('email not confirmed')) return t('auth.err.emailNotConfirmed');
  return msg;
}

export default function AuthScreen() {
  const c = useColors();
  const t = useT();
  const { lang } = useLang();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [showLegal, setShowLegal] = useState<null | 'disclaimer' | 'terms' | 'privacy'>(null);
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
    if (!email || !password) { show(t('auth.err.missingFields'), true); return; }
    if (mode === 'register' && password.length < 8) { show(t('auth.err.choosePassword'), true); return; }
    if (mode === 'register' && !accepted) { show(t('auth.err.acceptDisclaimer'), true); return; }
    setLoading(true);
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) show(translateError(error.message, t), true);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) show(translateError(error.message, t), true);
      else {
        // Zustimmung zum Haftungsausschluss dokumentieren (Zeitpunkt + Version)
        try { await AsyncStorage.setItem('fitavo.disclaimerAccepted', JSON.stringify({ version: DISCLAIMER_VERSION, at: new Date().toISOString(), health: true, terms: true, privacy: true })); } catch {}
        if (!data.session) { show(t('auth.msg.confirmEmail'), false); setMode('login'); }
      }
    }
    setLoading(false);
  }

  function openReset() {
    if (!email) { show(t('auth.err.enterEmailFirst'), true); return; }
    setResetStep('request'); setResetCode(''); setResetNewPw(''); setResetMsg(null); setResetErr(false);
    setShowReset(true);
  }
  async function sendResetCode() {
    setResetBusy(true); setResetMsg(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setResetBusy(false);
    if (error) { setResetMsg(translateError(error.message, t)); setResetErr(true); return; }
    setResetStep('code'); setResetMsg(t('auth.msg.resetCodeSent')); setResetErr(false);
  }
  async function confirmReset() {
    if (resetCode.trim().length < 6) { setResetMsg(t('auth.err.enterCode')); setResetErr(true); return; }
    if (resetNewPw.length < 8) { setResetMsg(t('auth.err.newPasswordTooShort')); setResetErr(true); return; }
    setResetBusy(true); setResetMsg(null);
    const { error: vErr } = await supabase.auth.verifyOtp({ email, token: resetCode.trim(), type: 'recovery' });
    if (vErr) { setResetBusy(false); setResetMsg(t('auth.err.codeInvalid')); setResetErr(true); return; }
    const { error: uErr } = await supabase.auth.updateUser({ password: resetNewPw });
    setResetBusy(false);
    if (uErr) { setResetMsg(t('auth.err.couldNotSetPassword', { msg: uErr.message })); setResetErr(true); return; }
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
            <Image source={require('../assets/avocado.png')} style={styles.logoImg} resizeMode="contain" />
            <Text style={styles.wordmark}>FitAvo</Text>
            <Text style={styles.tagline}>{t('auth.tagline')}</Text>
          </View>

          <View style={styles.form}>
            <GlassFill radius={22} />
            <Text style={styles.heading}>{mode === 'login' ? t('auth.heading.login') : t('auth.heading.register')}</Text>
            <Text style={styles.sub}>{mode === 'login' ? t('auth.sub.login') : t('auth.sub.register')}</Text>

            {info && (
              <View style={[styles.infoBox, { borderLeftColor: isError ? c.danger : c.success }]}>
                <Text style={[styles.info, { color: isError ? c.danger : c.success }]}>{info}</Text>
              </View>
            )}

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>{t('auth.label.email')}</Text>
              <TextInput
                style={[styles.fieldInput, focused === 'email' && styles.fieldInputFocused]}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                placeholder={t('auth.placeholder.email')}
                placeholderTextColor={c.textMuted}
                autoCapitalize="none" autoCorrect={false} keyboardType="email-address" inputMode="email"
                underlineColorAndroid="transparent"
                returnKeyType="next"
                onSubmitEditing={() => pwRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>{t('auth.label.password')}</Text>
              <View>
                <TextInput
                  ref={pwRef}
                  style={[styles.fieldInput, focused === 'pw' && styles.fieldInputFocused, { paddingRight: 48 }]}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocused('pw')}
                  onBlur={() => setFocused(null)}
                  placeholder={mode === 'register' ? t('auth.placeholder.passwordRegister') : t('auth.placeholder.password')}
                  placeholderTextColor={c.textMuted}
                  secureTextEntry={!showPw} autoCapitalize="none"
                  underlineColorAndroid="transparent"
                  returnKeyType={mode === 'login' ? 'go' : 'done'}
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity style={styles.pwToggle} onPress={() => setShowPw((s) => !s)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={showPw ? t('auth.a11y.hidePassword') : t('auth.a11y.showPassword')}>
                  <Text style={styles.pwToggleText}>{showPw ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {mode === 'login' && (
              <TouchableOpacity onPress={openReset} disabled={loading} style={styles.forgotWrap} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Text style={styles.forgot}>{t('auth.forgotPassword')}</Text>
              </TouchableOpacity>
            )}

            {mode === 'register' && (
              <TouchableOpacity style={styles.acceptRow} onPress={() => setAccepted((a) => !a)} activeOpacity={0.7} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} accessibilityLabel={t('auth.a11y.acceptLegal')}>
                <View style={[styles.checkbox, accepted && styles.checkboxOn]}>{accepted && <Text style={styles.checkmark}>✓</Text>}</View>
                <Text style={styles.acceptText}>
                  {t('auth.accept.prefix')}
                  <Text style={styles.acceptLink} onPress={() => setShowLegal('disclaimer')}>{t('auth.accept.disclaimer')}</Text>{t('auth.accept.middle')}
                  <Text style={styles.acceptLink} onPress={() => setShowLegal('terms')}>{t('auth.accept.terms')}</Text>
                  {t('auth.accept.and')}
                  <Text style={styles.acceptLink} onPress={() => setShowLegal('privacy')}>{t('auth.accept.privacy')}</Text>{t('auth.accept.suffix')}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.button, submitDisabled && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitDisabled} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.buttonText}>{mode === 'login' ? t('auth.button.login') : t('auth.button.register')}</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.switchWrap} onPress={() => switchMode(mode === 'login' ? 'register' : 'login')} activeOpacity={0.7}>
              <Text style={styles.switchText}>
                {mode === 'login' ? t('auth.switch.toRegister') : t('auth.switch.toLogin')}
                <Text style={styles.switchLink}>{mode === 'login' ? t('auth.switch.linkRegister') : t('auth.switch.linkLogin')}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={!!showLegal} animationType="slide" onRequestClose={() => setShowLegal(null)}>
        <View style={styles.modalRoot}>
          <Text style={styles.modalTitle}>
            {showLegal === 'terms' ? t('auth.modal.terms') : showLegal === 'privacy' ? t('auth.modal.privacy') : t('auth.modal.disclaimer')}
          </Text>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <LegalText c={c} sections={showLegal === 'terms' ? getTermsSections(lang) : showLegal === 'privacy' ? getPrivacySections(lang) : getDisclaimerSections(lang)} />
          </ScrollView>
          <TouchableOpacity style={styles.button} onPress={() => setShowLegal(null)} activeOpacity={0.85}>
            <Text style={styles.buttonText}>{t('auth.button.close')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={showReset} animationType="slide" transparent onRequestClose={() => setShowReset(false)}>
        <View style={styles.resetOverlay}>
          <View style={styles.resetCard}>
            <GlassFill radius={18} />
            <Text style={styles.modalTitle}>{t('auth.reset.title')}</Text>
            {resetStep === 'request' ? (
              <>
                <Text style={styles.resetText}>{t('auth.reset.sendInfo')}</Text>
                <Text style={styles.resetEmail}>{email || '—'}</Text>
                <TouchableOpacity style={styles.button} onPress={sendResetCode} disabled={resetBusy} activeOpacity={0.85}>
                  {resetBusy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.buttonText}>{t('auth.button.sendCode')}</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>{t('auth.reset.codeLabel')}</Text>
                <TextInput style={styles.fieldInput} value={resetCode} onChangeText={setResetCode} keyboardType="number-pad" placeholder={t('auth.reset.codePlaceholder')} placeholderTextColor={c.textMuted} maxLength={6} autoCapitalize="none" />
                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>{t('auth.reset.newPasswordLabel')}</Text>
                <TextInput style={styles.fieldInput} value={resetNewPw} onChangeText={setResetNewPw} secureTextEntry autoCapitalize="none" placeholder={t('auth.reset.newPasswordPlaceholder')} placeholderTextColor={c.textMuted} />
                <TouchableOpacity style={styles.button} onPress={confirmReset} disabled={resetBusy} activeOpacity={0.85}>
                  {resetBusy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.buttonText}>{t('auth.button.setPasswordLogin')}</Text>}
                </TouchableOpacity>
              </>
            )}
            {resetMsg && <Text style={[styles.info, { color: resetErr ? c.danger : c.success, marginTop: 12 }]}>{resetMsg}</Text>}
            <TouchableOpacity onPress={() => setShowReset(false)} style={{ marginTop: 14 }}>
              <Text style={styles.modalClose}>{t('auth.button.cancel')}</Text>
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
    logoImg: { width: 184, height: 184, marginBottom: 14 },
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
