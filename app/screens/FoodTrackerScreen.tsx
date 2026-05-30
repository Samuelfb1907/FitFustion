// Kalorien-Tracker / Tagebuch: eigene Zutaten auswählen, Menge angeben, Tag tracken.
// Zeigt Kalorien je Zutat und die Tagessumme vs. Ziel.
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { computeNutrition, ageFromBirthDate, Gender, ActivityLevel, GoalType } from '../lib/nutrition';

type Food = { id: string; name: string; category: string | null; kcal: number; protein: number; carbs: number; fat: number };
type LogEntry = { id: string; amount_g: number; food: Food | null };

function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function FoodTrackerScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [foods, setFoods] = useState<Food[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [targetKcal, setTargetKcal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<'diary' | 'pick' | 'amount'>('diary');
  const [search, setSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [amount, setAmount] = useState('100');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    init();
  }, [userId]);

  async function init() {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: foodData } = await supabase
      .from('foods')
      .select('id, name, category, kcal, protein, carbs, fat')
      .order('name');
    setFoods((foodData ?? []) as Food[]);

    const { data: prof } = await supabase
      .from('profiles')
      .select('weight_kg, height_cm, birth_date, gender, activity_level')
      .eq('id', userId)
      .maybeSingle();
    const { data: goal } = await supabase
      .from('goals')
      .select('goal_type')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prof && prof.weight_kg && prof.height_cm) {
      const t = computeNutrition({
        weightKg: Number(prof.weight_kg),
        heightCm: Number(prof.height_cm),
        age: ageFromBirthDate(prof.birth_date),
        gender: (prof.gender ?? 'prefer_not') as Gender,
        activity: (prof.activity_level ?? 'moderate') as ActivityLevel,
        goal: (goal?.goal_type ?? 'general_fitness') as GoalType,
      });
      setTargetKcal(t.targetCalories);
    }

    await loadLogs();
    setLoading(false);
  }

  async function loadLogs() {
    if (!userId) return;
    const { data } = await supabase
      .from('food_logs')
      .select('id, amount_g, foods(id, name, category, kcal, protein, carbs, fat)')
      .eq('user_id', userId)
      .eq('log_date', todayStr())
      .order('created_at');
    const mapped: LogEntry[] = (data ?? []).map((row: any) => ({
      id: row.id,
      amount_g: row.amount_g,
      food: Array.isArray(row.foods) ? row.foods[0] : row.foods,
    }));
    setLogs(mapped);
  }

  async function addLog() {
    if (!userId || !selectedFood) return;
    const a = Number(amount.replace(',', '.'));
    if (!a || a <= 0) {
      setError('Bitte gültige Menge in Gramm eingeben.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: e } = await supabase.from('food_logs').insert({
      user_id: userId,
      food_id: selectedFood.id,
      amount_g: a,
      log_date: todayStr(),
    });
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    setSelectedFood(null);
    setAmount('100');
    setSearch('');
    setMode('diary');
    await loadLogs();
  }

  async function deleteLog(id: string) {
    await supabase.from('food_logs').delete().eq('id', id);
    await loadLogs();
  }

  const kcalOf = (e: LogEntry) => (e.food ? Math.round((e.food.kcal * e.amount_g) / 100) : 0);
  const sumMacro = (sel: (f: Food) => number) =>
    Math.round(logs.reduce((s, e) => s + (e.food ? (sel(e.food) * e.amount_g) / 100 : 0), 0));
  const totalKcal = logs.reduce((s, e) => s + kcalOf(e), 0);
  const totalP = sumMacro((f) => f.protein);
  const totalC = sumMacro((f) => f.carbs);
  const totalF = sumMacro((f) => f.fat);
  const remaining = targetKcal != null ? targetKcal - totalKcal : null;

  const filteredFoods = search.trim()
    ? foods.filter((f) => f.name.toLowerCase().includes(search.trim().toLowerCase()))
    : foods;

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Tracker</Text>
        <ActivityIndicator size="large" color="#1F3864" style={{ marginTop: 40 }} />
      </View>
    );
  }

  // ---- Menge eingeben ----
  if (mode === 'amount' && selectedFood) {
    const a = Number(amount.replace(',', '.')) || 0;
    const previewKcal = Math.round((selectedFood.kcal * a) / 100);
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => setMode('pick')}>
          <Text style={styles.back}>‹ Zurück</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{selectedFood.name}</Text>
        <Text style={styles.subtitle}>{selectedFood.kcal} kcal / 100 g</Text>

        <Text style={styles.inputLabel}>Menge in Gramm</Text>
        <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="z. B. 150" />
        <Text style={styles.preview}>= {previewKcal} kcal</Text>

        <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={addLog} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Zum Tagebuch hinzufügen</Text>}
        </TouchableOpacity>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  }

  // ---- Zutat auswählen ----
  if (mode === 'pick') {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => { setMode('diary'); setSearch(''); }}>
          <Text style={styles.back}>‹ Zurück</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Zutat auswählen</Text>
        <TextInput style={styles.input} value={search} onChangeText={setSearch} placeholder="Suchen (z. B. Banane)…" autoCorrect={false} />
        <Text style={styles.countHint}>{filteredFoods.length} Zutaten</Text>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {filteredFoods.map((f) => (
            <TouchableOpacity key={f.id} style={styles.foodRow} onPress={() => { setSelectedFood(f); setAmount('100'); setError(null); setMode('amount'); }} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={styles.foodName}>{f.name}</Text>
                <Text style={styles.foodMeta}>{f.category}</Text>
              </View>
              <Text style={styles.foodKcal}>{f.kcal} kcal</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ---- Tagebuch ----
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Tracker</Text>
      <Text style={styles.subtitle}>Dein Essens-Tagebuch für heute</Text>

      <View style={styles.summary}>
        <View style={styles.sumCol}>
          <Text style={styles.sumValue}>{totalKcal}</Text>
          <Text style={styles.sumLabel}>gegessen</Text>
        </View>
        <View style={styles.sumCol}>
          <Text style={styles.sumValue}>{targetKcal ?? '–'}</Text>
          <Text style={styles.sumLabel}>Ziel</Text>
        </View>
        <View style={styles.sumCol}>
          <Text style={[styles.sumValue, remaining != null && remaining < 0 && { color: '#C62828' }]}>
            {remaining != null ? remaining : '–'}
          </Text>
          <Text style={styles.sumLabel}>übrig</Text>
        </View>
      </View>
      <Text style={styles.macroLine}>{totalP} g Protein · {totalC} g KH · {totalF} g Fett</Text>

      <TouchableOpacity style={styles.addBtn} onPress={() => setMode('pick')}>
        <Text style={styles.addText}>+ Zutat hinzufügen</Text>
      </TouchableOpacity>

      {logs.length === 0 ? (
        <Text style={styles.empty}>Noch nichts getrackt. Füge deine erste Zutat hinzu! 🍽️</Text>
      ) : (
        logs.map((e) => (
          <View key={e.id} style={styles.logRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.logName}>{e.food?.name ?? '—'}</Text>
              <Text style={styles.logMeta}>{e.amount_g} g</Text>
            </View>
            <Text style={styles.logKcal}>{kcalOf(e)} kcal</Text>
            <TouchableOpacity onPress={() => deleteLog(e.id)} style={styles.del}>
              <Text style={styles.delText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F5FA', paddingTop: 60, paddingHorizontal: 20 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1F3864' },
  subtitle: { fontSize: 15, color: '#666', marginTop: 2, marginBottom: 16 },
  back: { color: '#2E5496', fontSize: 15, fontWeight: '600', marginBottom: 10 },

  summary: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, paddingVertical: 18, marginBottom: 8 },
  sumCol: { flex: 1, alignItems: 'center' },
  sumValue: { fontSize: 24, fontWeight: 'bold', color: '#1F3864' },
  sumLabel: { fontSize: 12, color: '#8A97A8', marginTop: 2 },
  macroLine: { fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 16 },

  addBtn: { backgroundColor: '#1F3864', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  addText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  empty: { fontSize: 14, color: '#9AA5B4', textAlign: 'center', marginTop: 16 },

  logRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 },
  logName: { fontSize: 16, color: '#222', fontWeight: '600' },
  logMeta: { fontSize: 13, color: '#888', marginTop: 2 },
  logKcal: { fontSize: 15, fontWeight: '700', color: '#1F3864', marginRight: 12 },
  del: { padding: 4 },
  delText: { fontSize: 16, color: '#C7CFD9' },

  inputLabel: { fontSize: 14, color: '#444', fontWeight: '600', marginTop: 8, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#CFD8E3', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: '#fff' },
  preview: { fontSize: 18, fontWeight: '700', color: '#1F3864', marginTop: 14 },
  primaryBtn: { backgroundColor: '#1F3864', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  countHint: { fontSize: 12, color: '#8A97A8', marginTop: 8, marginBottom: 4 },
  foodRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 },
  foodName: { fontSize: 16, color: '#222', fontWeight: '600' },
  foodMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  foodKcal: { fontSize: 14, color: '#2E5496', fontWeight: '700', marginLeft: 8 },

  error: { color: '#B00020', fontSize: 14, marginTop: 14, textAlign: 'center' },
});
