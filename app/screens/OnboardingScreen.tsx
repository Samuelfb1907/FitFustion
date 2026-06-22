// Onboarding (themed): 4 Schritte (persönliche Daten, Erfahrung, Umgebung, Ziel).
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, PanResponder, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import Ambient from '../components/Ambient';
import GlassFill from '../components/GlassFill';
import { buildBirthDate, isUnderMinAge, MIN_AGE_YEARS } from '../lib/birthdate';
import { DISCLAIMER_VERSION } from '../lib/legal';
import { usePaywall } from '../components/Paywall';
import { computeNutrition, ageFromBirthDate, Gender, ActivityLevel, GoalType } from '../lib/nutrition';
import { ensurePermission, applyReminders, loadReminderPrefs, saveReminderPrefs } from '../lib/reminders';

type Opt = { label: string; value: string };

const GENDERS: Opt[] = [
  { label: 'onboarding.gender.male', value: 'male' }, { label: 'onboarding.gender.female', value: 'female' },
  { label: 'onboarding.gender.diverse', value: 'diverse' }, { label: 'onboarding.gender.prefer_not', value: 'prefer_not' },
];
const ACTIVITY: Opt[] = [
  { label: 'onboarding.activity.sedentary', value: 'sedentary' }, { label: 'onboarding.activity.light', value: 'light' },
  { label: 'onboarding.activity.moderate', value: 'moderate' }, { label: 'onboarding.activity.active', value: 'active' }, { label: 'onboarding.activity.very_active', value: 'very_active' },
];
const EXPERIENCE: Opt[] = [
  { label: 'onboarding.experience.beginner', value: 'beginner' }, { label: 'onboarding.experience.some', value: 'some' },
  { label: 'onboarding.experience.advanced', value: 'advanced' }, { label: 'onboarding.experience.pro', value: 'pro' },
];
const ENVIRONMENT: Opt[] = [
  { label: 'onboarding.environment.gym', value: 'gym' }, { label: 'onboarding.environment.home_gym', value: 'home_gym' }, { label: 'onboarding.environment.no_equipment', value: 'no_equipment' },
];
const GOALS: Opt[] = [
  { label: 'onboarding.goal.lose_weight', value: 'lose_weight' }, { label: 'onboarding.goal.build_muscle', value: 'build_muscle' }, { label: 'onboarding.goal.gain_strength', value: 'gain_strength' },
  { label: 'onboarding.goal.endurance', value: 'endurance' }, { label: 'onboarding.goal.general_fitness', value: 'general_fitness' }, { label: 'onboarding.goal.get_defined', value: 'get_defined' },
];
const TIMEFRAMES: Opt[] = [
  { label: 'onboarding.timeframe.8', value: '8' }, { label: 'onboarding.timeframe.12', value: '12' }, { label: 'onboarding.timeframe.16', value: '16' }, { label: 'onboarding.timeframe.24', value: '24' },
];

function Choice({ options, value, onChange, styles, t }: { options: Opt[]; value: string; onChange: (v: string) => void; styles: any; t: (key: string, vars?: Record<string, string | number>) => string }) {
  return (
    <View style={styles.choiceWrap}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <TouchableOpacity key={o.value} style={[styles.choice, active && styles.choiceActive]} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ selected: active }} accessibilityLabel={t(o.label)}>
            <GlassFill radius={14} />
            <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{t(o.label)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
export default function OnboardingScreen({ onDone }: { onDone: () => Promise<void> | void }) {
  const { session } = useAuth();
  const { openPaywall } = usePaywall();
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false); // Aha-Karte nach erfolgreichem Speichern
  const [pushOn, setPushOn] = useState(false); // Push-Erlaubnis im Abschluss-Schritt erteilt

  const [firstName, setFirstName] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [activity, setActivity] = useState('moderate');
  const [experience, setExperience] = useState('');
  const [environment, setEnvironment] = useState('');
  const [goal, setGoal] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [timeframe, setTimeframe] = useState('12');

  const totalSteps = 4;
  const num = (v: string) => Number(v.replace(',', '.'));

  function stepValid(): boolean {
    if (step === 1) return firstName.trim().length > 0 && !!buildBirthDate(birthDay, birthMonth, birthYear) && !!gender && num(weight) >= 30 && num(weight) <= 300 && num(height) >= 100 && num(height) <= 250;
    if (step === 2) return !!experience;
    if (step === 3) return !!environment;
    if (step === 4) { if (!goal) return false; if (goal === 'lose_weight') return num(targetWeight) >= 30 && num(targetWeight) <= 300; return true; }
    return false;
  }
  function stepError(): string | null {
    if (step === 1) {
      if (!firstName.trim()) return t('onboarding.error.firstNameRequired');
      if (!buildBirthDate(birthDay, birthMonth, birthYear)) {
        if (isUnderMinAge(birthDay, birthMonth, birthYear)) return t('onboarding.error.minAge', { n: MIN_AGE_YEARS });
        return t('onboarding.error.birthDateInvalid');
      }
      if (!gender) return t('onboarding.error.genderRequired');
      if (!(num(weight) >= 30 && num(weight) <= 300)) return t('onboarding.error.weightRange');
      if (!(num(height) >= 100 && num(height) <= 250)) return t('onboarding.error.heightRange');
    }
    if (step === 2 && !experience) return t('onboarding.error.experienceRequired');
    if (step === 3 && !environment) return t('onboarding.error.environmentRequired');
    if (step === 4) {
      if (!goal) return t('onboarding.error.goalRequired');
      if (goal === 'lose_weight' && !(num(targetWeight) >= 30 && num(targetWeight) <= 300)) return t('onboarding.error.targetWeightInvalid');
    }
    return null;
  }
  function next() { const e = stepError(); if (e) { setError(e); return; } setError(null); if (step < totalSteps) setStep(step + 1); else finish(); }
  function back() { setError(null); if (step > 1) setStep(step - 1); }

  // Vom linken Rand nach rechts wischen = einen Schritt zurueck.
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.x0 < 40 && g.dx > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onPanResponderRelease: (_, g) => {
        if (g.dx > 70 && Math.abs(g.dx) > Math.abs(g.dy)) { setError(null); setStep((s) => Math.max(1, s - 1)); }
      },
    }),
  ).current;

  async function finish() {
    if (!session?.user) return;
    setSaving(true); setError(null);
    const userId = session.user.id;
    const birth_date = buildBirthDate(birthDay, birthMonth, birthYear);
    if (!birth_date) { setSaving(false); setError(t('onboarding.error.birthDateInvalid')); return; }
    const { error: pErr } = await supabase.from('profiles').upsert({
      id: userId, first_name: firstName.trim(), birth_date, gender,
      weight_kg: num(weight), height_cm: num(height), activity_level: activity, experience_level: experience, training_environment: environment,
    });
    // Einwilligung serverseitig vermerken (best-effort: schlaegt fehl, solange
    // Migration 025 noch nicht lief -> blockiert das Onboarding NICHT).
    await supabase.from('profiles').update({ disclaimer_version: DISCLAIMER_VERSION, consented_at: new Date().toISOString() }).eq('id', userId);
    let targetDate: string | null = null;
    if (goal === 'lose_weight') { const d = new Date(); d.setDate(d.getDate() + Number(timeframe) * 7); targetDate = d.toISOString().slice(0, 10); }
    // Nur EIN aktives Ziel zulassen (Unique-Index goals_one_active_per_user): altes vorher deaktivieren
    await supabase.from('goals').update({ is_active: false }).eq('user_id', userId).eq('is_active', true);
    const { error: gErr } = await supabase.from('goals').insert({ user_id: userId, goal_type: goal, target_weight_kg: goal === 'lose_weight' ? num(targetWeight) : null, target_date: targetDate, is_active: true });
    setSaving(false);
    if (pErr || gErr) { console.error('Onboarding speichern:', pErr?.message || gErr?.message); setError(t('onboarding.error.saveFailed')); }
    else setDone(true);
  }

  // Tagesziel aus den Onboarding-Daten (reine Berechnung, kein DB-Zugriff).
  const plan = useMemo(() => {
    const birth_date = buildBirthDate(birthDay, birthMonth, birthYear);
    return computeNutrition({
      weightKg: num(weight), heightCm: num(height), age: ageFromBirthDate(birth_date),
      gender: (gender || 'prefer_not') as Gender, activity: activity as ActivityLevel, goal: (goal || 'general_fitness') as GoalType,
    });
  }, [weight, height, birthDay, birthMonth, birthYear, gender, activity, goal]);

  // Sanfte Push-Erlaubnis -> bei Zusage sinnvolle Standard-Erinnerungen aktivieren.
  async function enablePush() {
    const ok = await ensurePermission();
    if (!ok) { setPushOn(false); return; }
    const prefs = await loadReminderPrefs();
    const next = { ...prefs, enabled: true };
    await saveReminderPrefs(next);
    await applyReminders(next);
    setPushOn(true);
  }

  if (done) {
    return (
      <View style={styles.container}>
        <Ambient c={c} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
          <Text style={styles.title}>{t('onboarding.done.title', { name: firstName.trim() })}</Text>
          <Text style={styles.hint}>{t('onboarding.done.subtitle')}</Text>

          <View style={styles.planCard}>
            <GlassFill radius={20} />
            <Text style={styles.planKcal}>{t('onboarding.done.kcalValue', { kcal: plan.targetCalories })}</Text>
            <Text style={styles.planKcalLabel}>{t('onboarding.done.kcalLabel')}</Text>
            <View style={styles.macroRow}>
              <View style={styles.macroItem}><Text style={styles.macroVal}>{t('onboarding.done.gram', { n: plan.proteinG })}</Text><Text style={styles.macroLabel}>{t('onboarding.done.protein')}</Text></View>
              <View style={styles.macroItem}><Text style={styles.macroVal}>{t('onboarding.done.gram', { n: plan.carbsG })}</Text><Text style={styles.macroLabel}>{t('onboarding.done.carbs')}</Text></View>
              <View style={styles.macroItem}><Text style={styles.macroVal}>{t('onboarding.done.gram', { n: plan.fatG })}</Text><Text style={styles.macroLabel}>{t('onboarding.done.fat')}</Text></View>
            </View>
          </View>

          <TouchableOpacity style={styles.trialBtn} activeOpacity={0.85} onPress={() => openPaywall('plan')} accessibilityRole="button" accessibilityLabel={t('onboarding.done.tryTrial')}>
            <Text style={styles.trialBtnText}>{t('onboarding.done.tryTrial')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.pushRow} activeOpacity={0.85} onPress={enablePush} disabled={pushOn} accessibilityRole="button" accessibilityLabel={pushOn ? t('onboarding.done.pushOn') : t('onboarding.done.pushCta')}>
            <GlassFill radius={16} />
            <Text style={styles.pushIcon}>{pushOn ? '✓' : '🔔'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.pushTitle}>{pushOn ? t('onboarding.done.pushOn') : t('onboarding.done.pushCta')}</Text>
              <Text style={styles.pushDesc}>{t('onboarding.done.pushDesc')}</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.nav}>
          <TouchableOpacity style={[styles.navBtn, styles.navNext]} onPress={() => onDone()} accessibilityRole="button" accessibilityLabel={t('onboarding.done.start')}>
            <Text style={styles.navNextText}>{t('onboarding.done.start')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} {...swipe.panHandlers} behavior="padding">
      <Ambient c={c} />
      <View style={styles.progress}>
        {[1, 2, 3, 4].map((s) => (<View key={s} style={[styles.progressBar, s <= step && styles.progressBarActive]} />))}
      </View>
      <Text style={styles.stepLabel}>{t('onboarding.stepLabel', { current: step, total: totalSteps })}</Text>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <View>
            <Text style={styles.title}>{t('onboarding.step1.title')}</Text>
            <Text style={styles.label}>{t('onboarding.label.firstName')}</Text>
            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder={t('onboarding.placeholder.firstName')} placeholderTextColor={c.textMuted} />
            <Text style={styles.label}>{t('onboarding.label.birthDate')}</Text>
            <View style={styles.dateRow}>
              <TextInput style={[styles.input, styles.dateField]} value={birthDay} onChangeText={setBirthDay} placeholder={t('onboarding.placeholder.day')} placeholderTextColor={c.textMuted} keyboardType="numeric" inputMode="numeric" maxLength={2} />
              <TextInput style={[styles.input, styles.dateField]} value={birthMonth} onChangeText={setBirthMonth} placeholder={t('onboarding.placeholder.month')} placeholderTextColor={c.textMuted} keyboardType="numeric" inputMode="numeric" maxLength={2} />
              <TextInput style={[styles.input, styles.dateFieldYear]} value={birthYear} onChangeText={setBirthYear} placeholder={t('onboarding.placeholder.year')} placeholderTextColor={c.textMuted} keyboardType="numeric" inputMode="numeric" maxLength={4} />
            </View>
            <Text style={styles.label}>{t('onboarding.label.gender')}</Text>
            <Choice options={GENDERS} value={gender} onChange={setGender} styles={styles} t={t} />
            <Text style={styles.label}>{t('onboarding.label.weight')}</Text>
            <TextInput style={styles.input} value={weight} onChangeText={setWeight} placeholder={t('onboarding.placeholder.weight')} placeholderTextColor={c.textMuted} keyboardType="numeric" inputMode="decimal" />
            <Text style={styles.label}>{t('onboarding.label.height')}</Text>
            <TextInput style={styles.input} value={height} onChangeText={setHeight} placeholder={t('onboarding.placeholder.height')} placeholderTextColor={c.textMuted} keyboardType="numeric" inputMode="decimal" />
            <Text style={styles.label}>{t('onboarding.label.activity')}</Text>
            <Choice options={ACTIVITY} value={activity} onChange={setActivity} styles={styles} t={t} />
          </View>
        )}
        {step === 2 && (<View><Text style={styles.title}>{t('onboarding.step2.title')}</Text><Choice options={EXPERIENCE} value={experience} onChange={setExperience} styles={styles} t={t} /></View>)}
        {step === 3 && (<View><Text style={styles.title}>{t('onboarding.step3.title')}</Text><Choice options={ENVIRONMENT} value={environment} onChange={setEnvironment} styles={styles} t={t} /></View>)}
        {step === 4 && (
          <View>
            <Text style={styles.title}>{t('onboarding.step4.title')}</Text>
            <Choice options={GOALS} value={goal} onChange={setGoal} styles={styles} t={t} />
            {goal === 'lose_weight' && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.label}>{t('onboarding.label.targetWeight')}</Text>
                <TextInput style={styles.input} value={targetWeight} onChangeText={setTargetWeight} placeholder={t('onboarding.placeholder.targetWeight')} placeholderTextColor={c.textMuted} keyboardType="numeric" inputMode="decimal" />
                <Text style={styles.label}>{t('onboarding.label.timeframe')}</Text>
                <Choice options={TIMEFRAMES} value={timeframe} onChange={setTimeframe} styles={styles} t={t} />
              </View>
            )}
          </View>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.nav}>
        {step > 1 ? (
          <TouchableOpacity style={[styles.navBtn, styles.navBack]} onPress={back} disabled={saving}><GlassFill radius={16} /><Text style={styles.navBackText}>{t('onboarding.nav.back')}</Text></TouchableOpacity>
        ) : (<View style={{ flex: 1 }} />)}
        <TouchableOpacity style={[styles.navBtn, styles.navNext, saving && { opacity: 0.6 }]} onPress={next} disabled={saving}>
          {saving ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.navNextText}>{step < totalSteps ? t('onboarding.nav.next') : t('onboarding.nav.finish')}</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 56, paddingHorizontal: 16 },
    progress: { flexDirection: 'row', gap: 6, marginBottom: 8 },
    progressBar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.border },
    progressBarActive: { backgroundColor: c.primary },
    stepLabel: { color: c.textMuted, fontSize: 13, marginBottom: 16 },
    title: { fontSize: 24, fontWeight: '800', color: c.heading, marginBottom: 12 },
    hint: { fontSize: 14, color: c.textMuted, marginBottom: 16, lineHeight: 20 },
    label: { fontSize: 14, color: c.text, fontWeight: '600', marginTop: 14, marginBottom: 6 },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, backgroundColor: c.inputBg, color: c.text },
    dateRow: { flexDirection: 'row', gap: 10 },
    dateField: { flex: 1, textAlign: 'center' },
    dateFieldYear: { flex: 1.5, textAlign: 'center' },
    choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    choice: { borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: c.card },
    choiceActive: { backgroundColor: c.primary, borderColor: c.primary },
    choiceText: { color: c.text, fontSize: 15 },
    choiceTextActive: { color: c.onPrimary, fontWeight: '600' },
    selected: { marginTop: 14, color: c.primary, fontWeight: '600' },
    error: { color: c.danger, marginTop: 16, fontSize: 14 },
    nav: { flexDirection: 'row', paddingVertical: 16, gap: 12 },
    navBtn: { flex: 1, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
    navBack: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    navBackText: { color: c.primary, fontWeight: '600', fontSize: 16 },
    navNext: { backgroundColor: c.primary },
    navNextText: { color: c.onPrimary, fontWeight: '700', fontSize: 16 },
    planCard: { marginTop: 8, borderRadius: 20, paddingVertical: 22, paddingHorizontal: 18, alignItems: 'center', overflow: 'hidden' },
    planKcal: { fontSize: 40, fontWeight: '800', color: c.primary },
    planKcalLabel: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    macroRow: { flexDirection: 'row', gap: 16, marginTop: 18 },
    macroItem: { alignItems: 'center', flex: 1 },
    macroVal: { fontSize: 17, fontWeight: '800', color: c.heading },
    macroLabel: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    trialBtn: { marginTop: 20, backgroundColor: c.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
    trialBtnText: { color: c.onPrimary, fontSize: 17, fontWeight: '800' },
    pushRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, borderRadius: 16, padding: 14, overflow: 'hidden' },
    pushIcon: { fontSize: 22 },
    pushTitle: { fontSize: 15, fontWeight: '700', color: c.heading },
    pushDesc: { fontSize: 13, color: c.textMuted, marginTop: 1, lineHeight: 18 },
  });
}
