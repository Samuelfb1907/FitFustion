// Profil: persönliche Daten & Ziel bearbeiten (vorausgefüllt, speichert in profiles + goals).
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import { buildBirthDate, splitBirthDate } from '../lib/birthdate';
import BackButton from '../components/BackButton';
import GlassFill from '../components/GlassFill';
import { TAB_BAR_SPACE } from '../lib/layout';

type Opt = { label: string; value: string };
const GENDERS: Opt[] = [
  { label: 'profile.gender.male', value: 'male' },
  { label: 'profile.gender.female', value: 'female' },
  { label: 'profile.gender.diverse', value: 'diverse' },
  { label: 'profile.gender.prefer_not', value: 'prefer_not' },
];
const ACTIVITY: Opt[] = [
  { label: 'profile.activity.sedentary', value: 'sedentary' },
  { label: 'profile.activity.light', value: 'light' },
  { label: 'profile.activity.moderate', value: 'moderate' },
  { label: 'profile.activity.active', value: 'active' },
  { label: 'profile.activity.very_active', value: 'very_active' },
];
const GOALS: Opt[] = [
  { label: 'profile.goal.lose_weight', value: 'lose_weight' },
  { label: 'profile.goal.build_muscle', value: 'build_muscle' },
  { label: 'profile.goal.gain_strength', value: 'gain_strength' },
  { label: 'profile.goal.endurance', value: 'endurance' },
  { label: 'profile.goal.general_fitness', value: 'general_fitness' },
  { label: 'profile.goal.get_defined', value: 'get_defined' },
];
const LEVELS: Opt[] = [
  { label: 'profile.level.beginner', value: 'beginner' },
  { label: 'profile.level.some', value: 'some' },
  { label: 'profile.level.advanced', value: 'advanced' },
  { label: 'profile.level.pro', value: 'pro' },
];
const ENVIRONMENTS: Opt[] = [
  { label: 'profile.environment.gym', value: 'gym' },
  { label: 'profile.environment.home_gym', value: 'home_gym' },
  { label: 'profile.environment.no_equipment', value: 'no_equipment' },
];

export default function ProfileScreen({ onBack }: { onBack?: () => void }) {
  const { session, refreshProfile } = useAuth();
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

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

  const num = (v: string) => Number(v.replace(',', '.'));

  useEffect(() => {
    async function load() {
      const userId = session?.user?.id;
      if (!userId) return;
      const { data: prof } = await supabase
        .from('profiles')
        .select('first_name, birth_date, gender, weight_kg, height_cm, activity_level, experience_level, training_environment')
        .eq('id', userId)
        .maybeSingle();
      const { data: g } = await supabase
        .from('goals')
        .select('goal_type, target_weight_kg')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prof) {
        setFirstName(prof.first_name ?? '');
        const b = splitBirthDate(prof.birth_date);
        setBirthDay(b.day); setBirthMonth(b.month); setBirthYear(b.year);
        setGender(prof.gender ?? '');
        setWeight(prof.weight_kg != null ? String(prof.weight_kg) : '');
        setHeight(prof.height_cm != null ? String(prof.height_cm) : '');
        setActivity(prof.activity_level ?? 'moderate');
        setExperience(prof.experience_level ?? '');
        setEnvironment(prof.training_environment ?? '');
      }
      if (g) {
        setGoal(g.goal_type ?? '');
        setTargetWeight(g.target_weight_kg != null ? String(g.target_weight_kg) : '');
      }
      setLoading(false);
    }
    load();
  }, [session?.user?.id]);

  async function save() {
    const userId = session?.user?.id;
    if (!userId) return;
    // feldspezifische Validierung mit klaren Meldungen
    let err = '';
    if (!firstName.trim()) err = t('profile.err.firstName');
    else if (!buildBirthDate(birthDay, birthMonth, birthYear)) err = t('profile.err.birthDate');
    else if (!gender) err = t('profile.err.gender');
    else if (!(num(weight) >= 30 && num(weight) <= 300)) err = t('profile.err.weight');
    else if (!(num(height) >= 100 && num(height) <= 250)) err = t('profile.err.height');
    else if (!experience) err = t('profile.err.experience');
    else if (!environment) err = t('profile.err.environment');
    else if (!goal) err = t('profile.err.goal');
    else if (goal === 'lose_weight' && !(num(targetWeight) >= 30 && num(targetWeight) <= 300)) err = t('profile.err.targetWeight');
    if (err) { setMsg(err); setIsError(true); return; }
    setSaving(true);
    setMsg(null);
    const birth_date = buildBirthDate(birthDay, birthMonth, birthYear)!; // oben validiert

    const { error: pErr } = await supabase.from('profiles').upsert({
      id: userId,
      first_name: firstName.trim(),
      birth_date,
      gender,
      weight_kg: num(weight),
      height_cm: num(height),
      activity_level: activity,
      experience_level: experience,
      training_environment: environment,
    });

    // Ziel aktualisieren: bestehendes aktives Ziel IN PLACE updaten (kein Zeilen-Wachstum
    // bei jedem Speichern); nur neu anlegen, falls noch keins existiert.
    const goalRow = {
      goal_type: goal,
      target_weight_kg: goal === 'lose_weight' && targetWeight ? num(targetWeight) : null,
      is_active: true,
    };
    const { data: activeGoal } = await supabase
      .from('goals')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    let gErr: any = null;
    if (activeGoal?.id) {
      ({ error: gErr } = await supabase.from('goals').update(goalRow).eq('id', activeGoal.id));
    } else {
      ({ error: gErr } = await supabase.from('goals').insert({ user_id: userId, ...goalRow }));
    }

    setSaving(false);
    if (pErr || gErr) {
      console.error('Profil speichern:', pErr?.message || gErr?.message);
      setMsg(t('profile.saveFailed'));
      setIsError(true);
    } else {
      setMsg(t('profile.saved'));
      setIsError(false);
      await refreshProfile();
    }
  }

  function renderChoice(options: Opt[], value: string, onChange: (v: string) => void) {
    return (
      <View style={styles.choiceWrap}>
        {options.map((o) => {
          const active = value === o.value;
          return (
            <TouchableOpacity key={o.value} style={[styles.choice, active && styles.choiceActive]} onPress={() => onChange(o.value)}>
              <GlassFill radius={14} />
              <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{t(o.label)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        {onBack && <BackButton onPress={onBack} c={c} label={t('profile.backToSettings')} />}
        <Text style={styles.title}>{t('profile.title')}</Text>
        <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + 48 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      {onBack && <BackButton onPress={onBack} c={c} label={t('profile.backToSettings')} />}
      <Text style={styles.title}>{t('profile.title')}</Text>
      <Text style={styles.subtitle}>{t('profile.subtitle')}</Text>

      <Text style={styles.label}>{t('profile.firstName')}</Text>
      <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder={t('profile.firstNamePlaceholder')} placeholderTextColor={c.textMuted} />

      <Text style={styles.label}>{t('profile.birthDate')}</Text>
      <View style={styles.dateRow}>
        <TextInput style={[styles.input, styles.dateField]} value={birthDay} onChangeText={setBirthDay} keyboardType="numeric" inputMode="numeric" maxLength={2} placeholder={t('profile.birthDay')} placeholderTextColor={c.textMuted} />
        <TextInput style={[styles.input, styles.dateField]} value={birthMonth} onChangeText={setBirthMonth} keyboardType="numeric" inputMode="numeric" maxLength={2} placeholder={t('profile.birthMonth')} placeholderTextColor={c.textMuted} />
        <TextInput style={[styles.input, styles.dateFieldYear]} value={birthYear} onChangeText={setBirthYear} keyboardType="numeric" inputMode="numeric" maxLength={4} placeholder={t('profile.birthYear')} placeholderTextColor={c.textMuted} />
      </View>

      <Text style={styles.label}>{t('profile.gender')}</Text>
      {renderChoice(GENDERS, gender, setGender)}

      <Text style={styles.label}>{t('profile.weight')}</Text>
      <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="numeric" inputMode="decimal" placeholder={t('profile.weightPlaceholder')} placeholderTextColor={c.textMuted} />

      <Text style={styles.label}>{t('profile.height')}</Text>
      <TextInput style={styles.input} value={height} onChangeText={setHeight} keyboardType="numeric" inputMode="decimal" placeholder={t('profile.heightPlaceholder')} placeholderTextColor={c.textMuted} />

      <Text style={styles.label}>{t('profile.activity')}</Text>
      {renderChoice(ACTIVITY, activity, setActivity)}

      <Text style={styles.label}>{t('profile.experience')}</Text>
      {renderChoice(LEVELS, experience, setExperience)}

      <Text style={styles.label}>{t('profile.environment')}</Text>
      {renderChoice(ENVIRONMENTS, environment, setEnvironment)}

      <Text style={styles.label}>{t('profile.goal')}</Text>
      {renderChoice(GOALS, goal, setGoal)}

      {goal === 'lose_weight' && (
        <>
          <Text style={styles.label}>{t('profile.targetWeight')}</Text>
          <TextInput style={styles.input} value={targetWeight} onChangeText={setTargetWeight} keyboardType="numeric" inputMode="decimal" placeholder={t('profile.targetWeightPlaceholder')} placeholderTextColor={c.textMuted} />
        </>
      )}

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.saveText}>{t('profile.save')}</Text>}
      </TouchableOpacity>

      {msg && <Text style={[styles.msg, { color: isError ? c.danger : c.success }]}>{msg}</Text>}
    </ScrollView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 56, paddingHorizontal: 16 },
    back: { color: c.primary, fontSize: 15, fontWeight: '600', marginBottom: 10 },
    title: { fontSize: 26, fontWeight: '800', color: c.heading },
    subtitle: { fontSize: 15, color: c.textMuted, marginTop: 2, marginBottom: 8 },
    label: { fontSize: 14, color: c.text, fontWeight: '600', marginTop: 16, marginBottom: 6 },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, backgroundColor: c.inputBg, color: c.text },
    dateRow: { flexDirection: 'row', gap: 10 },
    dateField: { flex: 1, textAlign: 'center' },
    dateFieldYear: { flex: 1.5, textAlign: 'center' },
    choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    choice: { borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: c.card },
    choiceActive: { backgroundColor: c.primary, borderColor: c.primary },
    choiceText: { color: c.text, fontSize: 15 },
    choiceTextActive: { color: c.onPrimary, fontWeight: '600' },
    saveBtn: { backgroundColor: c.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
    saveText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
    msg: { fontSize: 14, textAlign: 'center', marginTop: 14 },
  });
}
