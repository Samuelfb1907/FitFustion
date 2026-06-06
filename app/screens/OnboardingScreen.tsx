// Onboarding (themed): 5 Schritte (persönliche Daten, Allergien, Erfahrung, Umgebung, Ziel).
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';

type Opt = { label: string; value: string };

const GENDERS: Opt[] = [
  { label: 'Männlich', value: 'male' }, { label: 'Weiblich', value: 'female' },
  { label: 'Divers', value: 'diverse' }, { label: 'Keine Angabe', value: 'prefer_not' },
];
const ACTIVITY: Opt[] = [
  { label: 'Kaum aktiv', value: 'sedentary' }, { label: 'Leicht aktiv', value: 'light' },
  { label: 'Mäßig aktiv', value: 'moderate' }, { label: 'Sehr aktiv', value: 'active' }, { label: 'Extrem aktiv', value: 'very_active' },
];
const ALLERGIES: Opt[] = [
  { label: 'Gluten', value: 'gluten' }, { label: 'Weizen', value: 'wheat' }, { label: 'Mais', value: 'corn' },
  { label: 'Milch (Kuhmilch)', value: 'milk' }, { label: 'Laktose', value: 'lactose' }, { label: 'Eier', value: 'eggs' },
  { label: 'Erdnüsse', value: 'peanuts' }, { label: 'Nüsse (allgemein)', value: 'tree_nuts' }, { label: 'Haselnuss', value: 'hazelnut' },
  { label: 'Mandel', value: 'almond' }, { label: 'Walnuss', value: 'walnut' }, { label: 'Cashew', value: 'cashew' },
  { label: 'Pistazie', value: 'pistachio' }, { label: 'Kokosnuss', value: 'coconut' }, { label: 'Sesam', value: 'sesame' },
  { label: 'Soja', value: 'soy' }, { label: 'Lupine', value: 'lupin' }, { label: 'Hülsenfrüchte (Linsen, Bohnen)', value: 'legumes' },
  { label: 'Fisch', value: 'fish' }, { label: 'Krebstiere', value: 'crustaceans' }, { label: 'Weichtiere', value: 'molluscs' },
  { label: 'Sellerie', value: 'celery' }, { label: 'Nachtschatten (z. B. Tomate)', value: 'nightshades' }, { label: 'Zitrusfrüchte', value: 'citrus' },
  { label: 'Apfel', value: 'apple' }, { label: 'Kiwi', value: 'kiwi' }, { label: 'Banane', value: 'banana' },
  { label: 'Erdbeere', value: 'strawberry' }, { label: 'Pfirsich', value: 'peach' }, { label: 'Knoblauch', value: 'garlic' }, { label: 'Zwiebel', value: 'onion' },
  { label: 'Fruktose', value: 'fructose' }, { label: 'Histamin', value: 'histamine' }, { label: 'Sulfite', value: 'sulphites' },
  { label: 'Senf', value: 'mustard' }, { label: 'Hefe', value: 'yeast' }, { label: 'Gelatine', value: 'gelatin' },
  { label: 'Kakao / Schokolade', value: 'cocoa' }, { label: 'Alkohol', value: 'alcohol' },
];
const EXPERIENCE: Opt[] = [
  { label: 'Anfänger', value: 'beginner' }, { label: 'Etwas erfahren', value: 'some' },
  { label: 'Fortgeschritten', value: 'advanced' }, { label: 'Profi', value: 'pro' },
];
const ENVIRONMENT: Opt[] = [
  { label: 'Fitnessstudio', value: 'gym' }, { label: 'Home-Gym', value: 'home_gym' }, { label: 'Ohne Equipment', value: 'no_equipment' },
];
const GOALS: Opt[] = [
  { label: 'Abnehmen', value: 'lose_weight' }, { label: 'Muskelaufbau', value: 'build_muscle' }, { label: 'Kraft steigern', value: 'gain_strength' },
  { label: 'Ausdauer verbessern', value: 'endurance' }, { label: 'Allgemeine Fitness', value: 'general_fitness' }, { label: 'Körper definieren', value: 'get_defined' },
];
const TIMEFRAMES: Opt[] = [
  { label: '8 Wochen', value: '8' }, { label: '12 Wochen', value: '12' }, { label: '16 Wochen', value: '16' }, { label: '24 Wochen', value: '24' },
];

function Choice({ options, value, onChange, styles }: { options: Opt[]; value: string; onChange: (v: string) => void; styles: any }) {
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
function MultiChoice({ options, values, onToggle, styles }: { options: Opt[]; values: string[]; onToggle: (v: string) => void; styles: any }) {
  return (
    <View style={styles.choiceWrap}>
      {options.map((o) => {
        const active = values.includes(o.value);
        return (
          <TouchableOpacity key={o.value} style={[styles.choice, active && styles.choiceActive]} onPress={() => onToggle(o.value)}>
            <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{active ? '✓ ' : ''}{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function OnboardingScreen({ onDone }: { onDone: () => Promise<void> | void }) {
  const { session } = useAuth();
  const c = useColors();
  const styles = makeStyles(c);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [activity, setActivity] = useState('moderate');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [experience, setExperience] = useState('');
  const [environment, setEnvironment] = useState('');
  const [goal, setGoal] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [timeframe, setTimeframe] = useState('12');

  const totalSteps = 5;
  const num = (v: string) => Number(v.replace(',', '.'));
  function toggleAllergy(v: string) { setAllergies((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])); }

  function stepValid(): boolean {
    if (step === 1) return firstName.trim().length > 0 && num(age) >= 10 && num(age) <= 100 && !!gender && num(weight) >= 30 && num(weight) <= 300 && num(height) >= 100 && num(height) <= 250;
    if (step === 2) return true;
    if (step === 3) return !!experience;
    if (step === 4) return !!environment;
    if (step === 5) { if (!goal) return false; if (goal === 'lose_weight') return num(targetWeight) >= 30 && num(targetWeight) <= 300; return true; }
    return false;
  }
  function stepError(): string | null {
    if (step === 1) {
      if (!firstName.trim()) return 'Bitte einen Vornamen eingeben.';
      if (!(num(age) >= 10 && num(age) <= 100)) return 'Alter muss zwischen 10 und 100 liegen.';
      if (!gender) return 'Bitte wähle dein Geschlecht.';
      if (!(num(weight) >= 30 && num(weight) <= 300)) return 'Gewicht muss zwischen 30 und 300 kg liegen.';
      if (!(num(height) >= 100 && num(height) <= 250)) return 'Größe muss zwischen 100 und 250 cm liegen.';
    }
    if (step === 3 && !experience) return 'Bitte wähle dein Erfahrungslevel.';
    if (step === 4 && !environment) return 'Bitte wähle deine Trainingsumgebung.';
    if (step === 5) {
      if (!goal) return 'Bitte wähle ein Ziel.';
      if (goal === 'lose_weight' && !(num(targetWeight) >= 30 && num(targetWeight) <= 300)) return 'Bitte ein gültiges Traumgewicht (30–300 kg) eingeben.';
    }
    return null;
  }
  function next() { const e = stepError(); if (e) { setError(e); return; } setError(null); if (step < totalSteps) setStep(step + 1); else finish(); }
  function back() { setError(null); if (step > 1) setStep(step - 1); }

  async function finish() {
    if (!session?.user) return;
    setSaving(true); setError(null);
    const userId = session.user.id;
    const birthYear = new Date().getFullYear() - Math.round(num(age));
    const { error: pErr } = await supabase.from('profiles').upsert({
      id: userId, first_name: firstName.trim(), birth_date: `${birthYear}-01-01`, gender,
      weight_kg: num(weight), height_cm: num(height), activity_level: activity, allergies, experience_level: experience, training_environment: environment,
    });
    let targetDate: string | null = null;
    if (goal === 'lose_weight') { const d = new Date(); d.setDate(d.getDate() + Number(timeframe) * 7); targetDate = d.toISOString().slice(0, 10); }
    // Nur EIN aktives Ziel zulassen (Unique-Index goals_one_active_per_user): altes vorher deaktivieren
    await supabase.from('goals').update({ is_active: false }).eq('user_id', userId).eq('is_active', true);
    const { error: gErr } = await supabase.from('goals').insert({ user_id: userId, goal_type: goal, target_weight_kg: goal === 'lose_weight' ? num(targetWeight) : null, target_date: targetDate, is_active: true });
    setSaving(false);
    if (pErr || gErr) setError('Speichern fehlgeschlagen: ' + (pErr?.message || gErr?.message));
    else await onDone();
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.progress}>
        {[1, 2, 3, 4, 5].map((s) => (<View key={s} style={[styles.progressBar, s <= step && styles.progressBarActive]} />))}
      </View>
      <Text style={styles.stepLabel}>Schritt {step} von {totalSteps}</Text>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <View>
            <Text style={styles.title}>Erzähl uns von dir</Text>
            <Text style={styles.label}>Vorname</Text>
            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="z. B. Samuel" placeholderTextColor={c.textMuted} />
            <Text style={styles.label}>Alter</Text>
            <TextInput style={styles.input} value={age} onChangeText={setAge} placeholder="z. B. 28" placeholderTextColor={c.textMuted} keyboardType="numeric" />
            <Text style={styles.label}>Geschlecht</Text>
            <Choice options={GENDERS} value={gender} onChange={setGender} styles={styles} />
            <Text style={styles.label}>Körpergewicht (kg)</Text>
            <TextInput style={styles.input} value={weight} onChangeText={setWeight} placeholder="z. B. 78" placeholderTextColor={c.textMuted} keyboardType="numeric" inputMode="decimal" />
            <Text style={styles.label}>Körpergröße (cm)</Text>
            <TextInput style={styles.input} value={height} onChangeText={setHeight} placeholder="z. B. 180" placeholderTextColor={c.textMuted} keyboardType="numeric" />
            <Text style={styles.label}>Aktivitätslevel</Text>
            <Choice options={ACTIVITY} value={activity} onChange={setActivity} styles={styles} />
          </View>
        )}
        {step === 2 && (
          <View>
            <Text style={styles.title}>Allergien & Unverträglichkeiten</Text>
            <Text style={styles.hint}>Wähle alles aus, was auf dich zutrifft. Wenn nichts zutrifft, einfach auf „Weiter".</Text>
            <MultiChoice options={ALLERGIES} values={allergies} onToggle={toggleAllergy} styles={styles} />
            <Text style={styles.selected}>{allergies.length === 0 ? 'Keine ausgewählt' : `${allergies.length} ausgewählt`}</Text>
          </View>
        )}
        {step === 3 && (<View><Text style={styles.title}>Wie viel Trainingserfahrung hast du?</Text><Choice options={EXPERIENCE} value={experience} onChange={setExperience} styles={styles} /></View>)}
        {step === 4 && (<View><Text style={styles.title}>Wo trainierst du?</Text><Choice options={ENVIRONMENT} value={environment} onChange={setEnvironment} styles={styles} /></View>)}
        {step === 5 && (
          <View>
            <Text style={styles.title}>Was ist dein Ziel?</Text>
            <Choice options={GOALS} value={goal} onChange={setGoal} styles={styles} />
            {goal === 'lose_weight' && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.label}>Traumgewicht (kg)</Text>
                <TextInput style={styles.input} value={targetWeight} onChangeText={setTargetWeight} placeholder="z. B. 72" placeholderTextColor={c.textMuted} keyboardType="numeric" />
                <Text style={styles.label}>Zielzeitraum</Text>
                <Choice options={TIMEFRAMES} value={timeframe} onChange={setTimeframe} styles={styles} />
              </View>
            )}
          </View>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.nav}>
        {step > 1 ? (
          <TouchableOpacity style={[styles.navBtn, styles.navBack]} onPress={back} disabled={saving}><Text style={styles.navBackText}>Zurück</Text></TouchableOpacity>
        ) : (<View style={{ flex: 1 }} />)}
        <TouchableOpacity style={[styles.navBtn, styles.navNext, saving && { opacity: 0.6 }]} onPress={next} disabled={saving}>
          {saving ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.navNextText}>{step < totalSteps ? 'Weiter' : 'Fertig'}</Text>}
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
  });
}
