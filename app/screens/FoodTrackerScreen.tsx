// Kalorien-Tracker / Tagebuch (themed): eigene Zutaten auswählen, Menge angeben, Tag tracken.
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { computeNutrition, ageFromBirthDate, Gender, ActivityLevel, GoalType } from '../lib/nutrition';
import BarcodeScanner from '../components/BarcodeScanner';
import { resolveBarcodeFood } from '../lib/barcodeFood';

type Food = { id: string; name: string; category: string | null; kcal: number; protein: number; carbs: number; fat: number };
type LogEntry = { id: string; amount_g: number; food: Food | null };

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const WATER_GOAL = 2500; // Tagesziel in ml

export default function FoodTrackerScreen({ embedded }: { embedded?: boolean }) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const c = useColors();
  const styles = makeStyles(c);

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
  const [waterMl, setWaterMl] = useState(0);
  const [waterIds, setWaterIds] = useState<string[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => { init(); }, [userId]);

  async function handleScanned(code: string) {
    setScannerOpen(false);
    if (!userId) return;
    setScanning(true);
    setError(null);
    const res = await resolveBarcodeFood(userId, code);
    setScanning(false);
    if (!res.food) {
      setError(res.reason === 'not_found'
        ? `Barcode ${code} nicht gefunden. Du kannst die Zutat manuell suchen.`
        : 'Konnte das Produkt nicht abrufen. Bitte nochmal versuchen.');
      return;
    }
    const food = res.food;
    // neu gescanntes Lebensmittel in die lokale Liste aufnehmen
    setFoods((prev) => (prev.some((f) => f.id === food.id) ? prev : [...prev, food].sort((a, b) => a.name.localeCompare(b.name))));
    setSelectedFood(food);
    setAmount('100');
    setMode('amount');
  }

  async function init() {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data: foodData } = await supabase.from('foods').select('id, name, category, kcal, protein, carbs, fat').order('name');
    setFoods((foodData ?? []) as Food[]);
    const { data: prof } = await supabase.from('profiles').select('weight_kg, height_cm, birth_date, gender, activity_level').eq('id', userId).maybeSingle();
    const { data: goal } = await supabase.from('goals').select('goal_type').eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (prof && prof.weight_kg && prof.height_cm) {
      const t = computeNutrition({
        weightKg: Number(prof.weight_kg), heightCm: Number(prof.height_cm), age: ageFromBirthDate(prof.birth_date),
        gender: (prof.gender ?? 'prefer_not') as Gender, activity: (prof.activity_level ?? 'moderate') as ActivityLevel, goal: (goal?.goal_type ?? 'general_fitness') as GoalType,
      });
      setTargetKcal(t.targetCalories);
    }
    await loadLogs();
    await loadWater();
    setLoading(false);
  }

  async function loadWater() {
    if (!userId) return;
    const { data } = await supabase.from('water_logs').select('id, amount_ml').eq('user_id', userId).eq('log_date', todayStr()).order('created_at');
    const rows = (data ?? []) as any[];
    setWaterMl(rows.reduce((s, r) => s + (r.amount_ml ?? 0), 0));
    setWaterIds(rows.map((r) => r.id));
  }

  async function addWater(ml: number) {
    if (!userId) return;
    await supabase.from('water_logs').insert({ user_id: userId, amount_ml: ml, log_date: todayStr() });
    await loadWater();
  }

  async function undoWater() {
    if (!userId || !waterIds.length) return;
    await supabase.from('water_logs').delete().eq('id', waterIds[waterIds.length - 1]);
    await loadWater();
  }

  async function loadLogs() {
    if (!userId) return;
    const { data } = await supabase.from('food_logs').select('id, amount_g, foods(id, name, category, kcal, protein, carbs, fat)').eq('user_id', userId).eq('log_date', todayStr()).order('created_at');
    setLogs((data ?? []).map((row: any) => ({ id: row.id, amount_g: row.amount_g, food: Array.isArray(row.foods) ? row.foods[0] : row.foods })));
  }

  async function addLog() {
    if (!userId || !selectedFood) return;
    const a = Number(amount.replace(',', '.'));
    if (!a || a <= 0) { setError('Bitte gültige Menge in Gramm eingeben.'); return; }
    setSaving(true); setError(null);
    const { error: e } = await supabase.from('food_logs').insert({ user_id: userId, food_id: selectedFood.id, amount_g: a, log_date: todayStr() });
    setSaving(false);
    if (e) { setError(e.message); return; }
    setSelectedFood(null); setAmount('100'); setSearch(''); setMode('diary');
    await loadLogs();
  }

  async function deleteLog(id: string) {
    await supabase.from('food_logs').delete().eq('id', id);
    await loadLogs();
  }

  const kcalOf = (e: LogEntry) => (e.food ? Math.round((e.food.kcal * e.amount_g) / 100) : 0);
  const sumMacro = (sel: (f: Food) => number) => Math.round(logs.reduce((s, e) => s + (e.food ? (sel(e.food) * e.amount_g) / 100 : 0), 0));
  const totalKcal = logs.reduce((s, e) => s + kcalOf(e), 0);
  const totalP = sumMacro((f) => f.protein), totalC = sumMacro((f) => f.carbs), totalF = sumMacro((f) => f.fat);
  const remaining = targetKcal != null ? targetKcal - totalKcal : null;
  const filteredFoods = search.trim() ? foods.filter((f) => f.name.toLowerCase().includes(search.trim().toLowerCase())) : foods;

  if (loading) {
    return (<View style={[styles.container, embedded && styles.embedded]}>{!embedded && <Text style={styles.title}>Tracker</Text>}<ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} /></View>);
  }

  if (scanning) {
    return (
      <View style={[styles.container, embedded && styles.embedded]}>
        <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 60 }} />
        <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 14 }]}>Produkt wird gesucht…</Text>
      </View>
    );
  }

  if (mode === 'amount' && selectedFood) {
    const a = Number(amount.replace(',', '.')) || 0;
    const previewKcal = Math.round((selectedFood.kcal * a) / 100);
    return (
      <View style={[styles.container, embedded && styles.embedded]}>
        <TouchableOpacity onPress={() => setMode('pick')}><Text style={styles.back}>‹ Zurück</Text></TouchableOpacity>
        <Text style={styles.title}>{selectedFood.name}</Text>
        <Text style={styles.subtitle}>{selectedFood.kcal} kcal / 100 g</Text>
        <Text style={styles.inputLabel}>Menge in Gramm</Text>
        <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="z. B. 150" placeholderTextColor={c.textMuted} />
        <Text style={styles.preview}>= {previewKcal} kcal</Text>
        <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={addLog} disabled={saving}>
          {saving ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.primaryText}>Zum Tagebuch hinzufügen</Text>}
        </TouchableOpacity>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  }

  if (mode === 'pick') {
    return (
      <View style={[styles.container, embedded && styles.embedded]}>
        <TouchableOpacity onPress={() => { setMode('diary'); setSearch(''); }}><Text style={styles.back}>‹ Zurück</Text></TouchableOpacity>
        <Text style={styles.title}>Zutat auswählen</Text>
        <TextInput style={styles.input} value={search} onChangeText={setSearch} placeholder="Suchen (z. B. Banane)…" placeholderTextColor={c.textMuted} autoCorrect={false} />
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

  return (
    <>
    <ScrollView style={[styles.container, embedded && styles.embedded]} contentContainerStyle={{ paddingBottom: 40 }}>
      {!embedded && <Text style={styles.title}>Tracker</Text>}
      <Text style={styles.subtitle}>Dein Essens-Tagebuch für heute</Text>

      <View style={styles.waterCard}>
        <View style={styles.waterTop}>
          <Text style={styles.waterTitle}>💧 Wasser{waterMl >= WATER_GOAL ? '  ✓' : ''}</Text>
          <Text style={styles.waterVal}>{waterMl} / {WATER_GOAL} ml</Text>
        </View>
        <View style={styles.waterTrack}>
          <View style={[styles.waterFill, { width: `${Math.min(100, Math.round((waterMl / WATER_GOAL) * 100))}%` }]} />
        </View>
        <View style={styles.waterBtns}>
          <TouchableOpacity style={styles.waterBtn} onPress={() => addWater(250)} activeOpacity={0.8}><Text style={styles.waterBtnText}>+250 ml 🥛</Text></TouchableOpacity>
          <TouchableOpacity style={styles.waterBtn} onPress={() => addWater(500)} activeOpacity={0.8}><Text style={styles.waterBtnText}>+500 ml 🍶</Text></TouchableOpacity>
          <TouchableOpacity style={styles.waterUndo} onPress={undoWater} activeOpacity={0.8}><Text style={styles.waterUndoText}>↩</Text></TouchableOpacity>
        </View>
      </View>

      <View style={styles.summary}>
        <View style={styles.sumCol}><Text style={styles.sumValue}>{totalKcal}</Text><Text style={styles.sumLabel}>gegessen</Text></View>
        <View style={styles.sumCol}><Text style={styles.sumValue}>{targetKcal ?? '–'}</Text><Text style={styles.sumLabel}>Ziel</Text></View>
        <View style={styles.sumCol}><Text style={[styles.sumValue, remaining != null && remaining < 0 && { color: c.danger }]}>{remaining != null ? remaining : '–'}</Text><Text style={styles.sumLabel}>übrig</Text></View>
      </View>
      <Text style={styles.macroLine}>{totalP} g Protein · {totalC} g KH · {totalF} g Fett</Text>
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.addBtnRow} onPress={() => setMode('pick')}>
          <Text style={styles.addText}>➕  Hinzufügen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.scanBtn} onPress={() => { setError(null); setScannerOpen(true); }}>
          <Text style={styles.scanText}>📷  Scannen</Text>
        </TouchableOpacity>
      </View>
      {logs.length === 0 ? (
        <Text style={styles.empty}>Noch nichts getrackt. Füge deine erste Zutat hinzu! 🍽️</Text>
      ) : (
        logs.map((e) => (
          <View key={e.id} style={styles.logRow}>
            <View style={{ flex: 1 }}><Text style={styles.logName}>{e.food?.name ?? '—'}</Text><Text style={styles.logMeta}>{e.amount_g} g</Text></View>
            <Text style={styles.logKcal}>{kcalOf(e)} kcal</Text>
            <TouchableOpacity onPress={() => deleteLog(e.id)} style={styles.del}><Text style={styles.delText}>✕</Text></TouchableOpacity>
          </View>
        ))
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
    <BarcodeScanner visible={scannerOpen} c={c} onClose={() => setScannerOpen(false)} onScanned={handleScanned} />
    </>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 60, paddingHorizontal: 20 },
    embedded: { paddingTop: 8, paddingHorizontal: 0, backgroundColor: 'transparent' },
    title: { fontSize: 26, fontWeight: 'bold', color: c.heading },
    subtitle: { fontSize: 15, color: c.textMuted, marginTop: 2, marginBottom: 16 },
    back: { color: c.primary, fontSize: 15, fontWeight: '600', marginBottom: 10 },
    summary: { flexDirection: 'row', backgroundColor: c.card, borderRadius: 16, paddingVertical: 18, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    sumCol: { flex: 1, alignItems: 'center' },
    sumValue: { fontSize: 24, fontWeight: 'bold', color: c.heading },
    sumLabel: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    macroLine: { fontSize: 13, color: c.textMuted, textAlign: 'center', marginBottom: 16 },
    waterCard: { backgroundColor: c.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    waterTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    waterTitle: { fontSize: 16, fontWeight: '700', color: c.heading },
    waterVal: { fontSize: 14, fontWeight: '700', color: c.primary },
    waterTrack: { height: 10, backgroundColor: c.track, borderRadius: 5, overflow: 'hidden', marginTop: 10 },
    waterFill: { height: 10, backgroundColor: c.primary, borderRadius: 5 },
    waterBtns: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' },
    waterBtn: { flex: 1, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
    waterBtnText: { color: c.primary, fontWeight: '700', fontSize: 14 },
    waterUndo: { width: 46, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
    waterUndoText: { color: c.textMuted, fontSize: 16, fontWeight: '700' },
    addBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
    addText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
    actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    addBtnRow: { flex: 1, backgroundColor: c.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
    scanBtn: { flex: 1, backgroundColor: c.card, borderWidth: 1, borderColor: c.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
    scanText: { color: c.primary, fontSize: 16, fontWeight: '700' },
    empty: { fontSize: 14, color: c.textMuted, textAlign: 'center', marginTop: 16 },
    logRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    logName: { fontSize: 16, color: c.text, fontWeight: '600' },
    logMeta: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    logKcal: { fontSize: 15, fontWeight: '700', color: c.heading, marginRight: 12 },
    del: { padding: 4 },
    delText: { fontSize: 16, color: c.textMuted },
    inputLabel: { fontSize: 14, color: c.text, fontWeight: '600', marginTop: 8, marginBottom: 6 },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: c.inputBg, color: c.text },
    preview: { fontSize: 18, fontWeight: '700', color: c.heading, marginTop: 14 },
    primaryBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
    primaryText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
    countHint: { fontSize: 12, color: c.textMuted, marginTop: 8, marginBottom: 4 },
    foodRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    foodName: { fontSize: 16, color: c.text, fontWeight: '600' },
    foodMeta: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    foodKcal: { fontSize: 14, color: c.primary, fontWeight: '700', marginLeft: 8 },
    error: { color: c.danger, fontSize: 14, marginTop: 14, textAlign: 'center' },
  });
}
