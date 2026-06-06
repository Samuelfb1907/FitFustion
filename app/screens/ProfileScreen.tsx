// Profil: persönliche Daten & Ziel bearbeiten (vorausgefüllt, speichert in profiles + goals).
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { ageFromBirthDate } from '../lib/nutrition';

type Opt = { label: string; value: string };
const GENDERS: Opt[] = [
  { label: 'Männlich', value: 'male' },
  { label: 'Weiblich', value: 'female' },
  { label: 'Divers', value: 'diverse' },
  { label: 'Keine Angabe', value: 'prefer_not' },
];
const ACTIVITY: Opt[] = [
  { label: 'Kaum aktiv', value: 'sedentary' },
  { label: 'Leicht aktiv', value: 'light' },
  { label: 'Mäßig aktiv', value: 'moderate' },
  { label: 'Sehr aktiv', value: 'active' },
  { label: 'Extrem aktiv', value: 'very_active' },
];
const GOALS: Opt[] = [
  { label: 'Abnehmen', value: 'lose_weight' },
  { label: 'Muskelaufbau', value: 'build_muscle' },
  { label: 'Kraft steigern', value: 'gain_strength' },
  { label: 'Ausdauer verbessern', value: 'endurance' },
  { label: 'Allgemeine Fitness', value: 'general_fitness' },
  { label: 'Körper definieren', value: 'get_defined' },
];
const LEVELS: Opt[] = [
  { label: 'Anfänger', value: 'beginner' },
  { label: 'Etwas Erfahrung', value: 'some' },
  { label: 'Fortgeschritten', value: 'advanced' },
  { label: 'Profi', value: 'pro' },
];
const ENVIRONMENTS: Opt[] = [
  { label: 'Fitnessstudio', value: 'gym' },
  { label: 'Home-Gym', value: 'home_gym' },
  { label: 'Kein Equipment', value: 'no_equipment' },
];

export default function ProfileScreen({ onBack }: { onBack?: () => void }) {
  const { session, refreshProfile } = useAuth();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [activity, setActivity] = useState('moderate');
  const [experience, setExperience] = useState('');
  const [environment, setEnvironment] = useState('');
  const [goal, setGoal] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [origBirthDate, setOrigBirthDate] = useState<string | null>(null);

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
        setOrigBirthDate(prof.birth_date ?? null);
        setAge(prof.birth_date ? String(ageFromBirthDate(prof.birth_date)) : '');
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
    if (!firstName.trim()) err = 'Bitte einen Vornamen eingeben.';
    else if (!(num(age) >= 10 && num(age) <= 100)) err = 'Alter muss zwischen 10 und 100 liegen.';
    else if (!gender) err = 'Bitte wähle dein Geschlecht.';
    else if (!(num(weight) >= 30 && num(weight) <= 300)) err = 'Gewicht muss zwischen 30 und 300 kg liegen.';
    else if (!(num(height) >= 100 && num(height) <= 250)) err = 'Größe muss zwischen 100 und 250 cm liegen.';
    else if (!experience) err = 'Bitte wähle dein Erfahrungslevel.';
    else if (!environment) err = 'Bitte wähle deine Trainingsumgebung.';
    else if (!goal) err = 'Bitte wähle ein Ziel.';
    if (err) { setMsg(err); setIsError(true); return; }
    setSaving(true);
    setMsg(null);
    // Geburtsdatum erhalten: nur wenn sich das Alter geändert hat, neu setzen (sonst Monat/Tag bewahren)
    const enteredAge = Math.round(num(age));
    const birth_date = origBirthDate && ageFromBirthDate(origBirthDate) === enteredAge
      ? origBirthDate
      : `${new Date().getFullYear() - enteredAge}-01-01`;

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

    // Ziel aktualisieren: altes aktives deaktivieren, neues anlegen
    await supabase.from('goals').update({ is_active: false }).eq('user_id', userId).eq('is_active', true);
    const { error: gErr } = await supabase.from('goals').insert({
      user_id: userId,
      goal_type: goal,
      target_weight_kg: goal === 'lose_weight' && targetWeight ? num(targetWeight) : null,
      is_active: true,
    });

    setSaving(false);
    if (pErr || gErr) {
      setMsg('Speichern fehlgeschlagen: ' + (pErr?.message || gErr?.message));
      setIsError(true);
    } else {
      setMsg('Profil gespeichert ✓');
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
              <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        {onBack && (<TouchableOpacity onPress={onBack}><Text style={styles.back}>‹ Einstellungen</Text></TouchableOpacity>)}
        <Text style={styles.title}>Profil</Text>
        <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {onBack && (<TouchableOpacity onPress={onBack}><Text style={styles.back}>‹ Einstellungen</Text></TouchableOpacity>)}
      <Text style={styles.title}>Profil</Text>
      <Text style={styles.subtitle}>Deine Daten – jederzeit anpassbar</Text>

      <Text style={styles.label}>Vorname</Text>
      <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="Vorname" placeholderTextColor={c.textMuted} />

      <Text style={styles.label}>Alter</Text>
      <TextInput style={styles.input} value={age} onChangeText={setAge} keyboardType="numeric" placeholder="z. B. 28" placeholderTextColor={c.textMuted} />

      <Text style={styles.label}>Geschlecht</Text>
      {renderChoice(GENDERS, gender, setGender)}

      <Text style={styles.label}>Körpergewicht (kg)</Text>
      <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="numeric" inputMode="decimal" placeholder="z. B. 78" placeholderTextColor={c.textMuted} />

      <Text style={styles.label}>Körpergröße (cm)</Text>
      <TextInput style={styles.input} value={height} onChangeText={setHeight} keyboardType="numeric" inputMode="decimal" placeholder="z. B. 180" placeholderTextColor={c.textMuted} />

      <Text style={styles.label}>Aktivitätslevel</Text>
      {renderChoice(ACTIVITY, activity, setActivity)}

      <Text style={styles.label}>Erfahrungslevel</Text>
      {renderChoice(LEVELS, experience, setExperience)}

      <Text style={styles.label}>Trainingsumgebung</Text>
      {renderChoice(ENVIRONMENTS, environment, setEnvironment)}

      <Text style={styles.label}>Ziel</Text>
      {renderChoice(GOALS, goal, setGoal)}

      {goal === 'lose_weight' && (
        <>
          <Text style={styles.label}>Traumgewicht (kg)</Text>
          <TextInput style={styles.input} value={targetWeight} onChangeText={setTargetWeight} keyboardType="numeric" inputMode="decimal" placeholder="z. B. 72" placeholderTextColor={c.textMuted} />
        </>
      )}

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.saveText}>Speichern</Text>}
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
