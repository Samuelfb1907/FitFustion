// Kalorien-Tracker / Tagebuch (themed): eigene Zutaten auswählen, Menge angeben, Tag tracken.
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { computeNutrition, ageFromBirthDate, Gender, ActivityLevel, GoalType } from '../lib/nutrition';
import BarcodeScanner from '../components/BarcodeScanner';
import { resolveBarcodeFood } from '../lib/barcodeFood';
import { TRACKER_MEALS, MealType, mealByHour, normalizeMeal } from '../lib/meals';
import { NUTRITION_DISCLAIMER, ALLERGY_HINT } from '../lib/legal';
import { useFocusTick } from '../lib/useFocusTick';
import ErrorRetry from '../components/ErrorRetry';
import { errorMessage } from '../lib/errors';
import { todayStr } from '../lib/date';
import { CARD_SHADOW as shadow } from '../lib/ui';

type Food = { id: string; name: string; category: string | null; kcal: number; protein: number; carbs: number; fat: number; user_id?: string | null };
type LogEntry = { id: string; amount_g: number; meal_type: string | null; food: Food | null };
type QuickFood = { food: Food; amount: number; count: number };

// todayStr -> lib/date.ts

export default function FoodTrackerScreen({ embedded, focusTick }: { embedded?: boolean; focusTick?: number }) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [loading, setLoading] = useState(true);
  const [foods, setFoods] = useState<Food[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [targetKcal, setTargetKcal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'diary' | 'pick' | 'amount' | 'newfood'>('diary');
  const [search, setSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [amount, setAmount] = useState('100');
  const [mealType, setMealType] = useState<MealType>(mealByHour());
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [quickFoods, setQuickFoods] = useState<QuickFood[]>([]);
  const [quickMsg, setQuickMsg] = useState<string | null>(null);
  // Formular "Eigenes Lebensmittel anlegen"
  const [nf, setNf] = useState({ name: '', cat: '', kcal: '', protein: '', carbs: '', fat: '' });
  const [savingFood, setSavingFood] = useState(false);
  const [foodErr, setFoodErr] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { init(); }, [userId]);

  // Reiter erneut angetippt -> zurueck zum Tagebuch + leise aktualisieren (ohne Spinner)
  useFocusTick(focusTick, () => {
    setMode('diary'); setSelectedFood(null); setSearch(''); setError(null); setScannerOpen(false);
    loadLogs(); loadQuick();
  });

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
    setMealType(mealByHour());
    setMode('amount');
  }

  async function init(silent = false) {
    if (!userId) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
    const { data: foodData, error: fErr } = await supabase.from('foods').select('id, name, category, kcal, protein, carbs, fat, user_id').order('name');
    if (fErr) throw fErr;
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
    await loadQuick();
    setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    init(true);
  }

  async function loadLogs() {
    if (!userId) return;
    const { data } = await supabase.from('food_logs').select('id, amount_g, meal_type, foods(id, name, category, kcal, protein, carbs, fat)').eq('user_id', userId).eq('log_date', todayStr()).order('created_at');
    setLogs((data ?? []).map((row: any) => ({ id: row.id, amount_g: row.amount_g, meal_type: row.meal_type ?? null, food: Array.isArray(row.foods) ? row.foods[0] : row.foods })));
  }

  // Haeufigste/zuletzt genutzte Lebensmittel aus der Historie fuer den Schnellzugriff
  async function loadQuick() {
    if (!userId) return;
    const { data } = await supabase
      .from('food_logs')
      .select('amount_g, foods(id, name, category, kcal, protein, carbs, fat, user_id)')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(120);
    const map = new Map<string, { food: Food; amount: number; count: number; order: number }>();
    ((data ?? []) as any[]).forEach((row, idx) => {
      const food = Array.isArray(row.foods) ? row.foods[0] : row.foods;
      if (!food) return;
      const ex = map.get(food.id);
      if (ex) ex.count += 1;
      else map.set(food.id, { food, amount: row.amount_g ?? 100, count: 1, order: idx });
    });
    const list = [...map.values()]
      .sort((a, b) => b.count - a.count || a.order - b.order)
      .slice(0, 8)
      .map((x) => ({ food: x.food, amount: x.amount, count: x.count }));
    setQuickFoods(list);
  }

  async function quickAdd(qf: QuickFood) {
    if (!userId) return;
    setQuickMsg(null);
    const { error: e } = await supabase.from('food_logs').insert({ user_id: userId, food_id: qf.food.id, amount_g: qf.amount, log_date: todayStr(), meal_type: mealByHour() });
    if (e) { setError(errorMessage(e)); return; }
    setQuickMsg(`✓ ${qf.food.name} (${qf.amount} g) hinzugefügt`);
    setTimeout(() => setQuickMsg(null), 2500);
    await loadLogs();
    await loadQuick();
  }

  async function addLog() {
    if (!userId || !selectedFood) return;
    const a = Number(amount.replace(',', '.'));
    if (!a || a <= 0) { setError('Bitte gültige Menge in Gramm eingeben.'); return; }
    setSaving(true); setError(null);
    const { error: e } = await supabase.from('food_logs').insert({ user_id: userId, food_id: selectedFood.id, amount_g: a, log_date: todayStr(), meal_type: mealType });
    setSaving(false);
    if (e) { setError(errorMessage(e)); return; }
    setSelectedFood(null); setAmount('100'); setSearch(''); setMode('diary');
    await loadLogs();
    await loadQuick();
  }

  function deleteLog(id: string) {
    Alert.alert('Eintrag löschen?', 'Diesen Tagebuch-Eintrag entfernen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => doDeleteLog(id) },
    ]);
  }
  async function doDeleteLog(id: string) {
    const { error } = await supabase.from('food_logs').delete().eq('id', id);
    if (error) { Alert.alert('Nicht möglich', errorMessage(error)); return; }
    await loadLogs();
  }

  function openNewFood() {
    setNf({ name: search.trim(), cat: '', kcal: '', protein: '', carbs: '', fat: '' });
    setFoodErr(null);
    setMode('newfood');
  }

  async function saveFood() {
    if (!userId) return;
    const name = nf.name.trim();
    const kcal = Number(nf.kcal.replace(',', '.'));
    if (!name) { setFoodErr('Bitte einen Namen eingeben.'); return; }
    if (!kcal || kcal <= 0) { setFoodErr('Bitte gültige Kalorien (pro 100 g) eingeben.'); return; }
    const num = (s: string) => Math.max(0, Number(s.replace(',', '.')) || 0);
    setSavingFood(true); setFoodErr(null);
    const { data, error } = await supabase
      .from('foods')
      .insert({ name, category: nf.cat.trim() || 'Eigene', kcal, protein: num(nf.protein), carbs: num(nf.carbs), fat: num(nf.fat), user_id: userId })
      .select('id, name, category, kcal, protein, carbs, fat, user_id')
      .single();
    setSavingFood(false);
    if (error || !data) {
      setFoodErr((error as any)?.code === '23505'
        ? 'Es gibt bereits ein Lebensmittel mit diesem Namen.'
        : 'Speichern fehlgeschlagen: ' + (error?.message ?? ''));
      return;
    }
    const food = data as Food;
    setFoods((prev) => [...prev, food].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedFood(food); setAmount('100'); setError(null); setMode('amount');
  }

  function confirmDeleteFood(food: Food) {
    Alert.alert('Lebensmittel löschen?', `„${food.name}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => doDeleteFood(food.id) },
    ]);
  }
  async function doDeleteFood(id: string) {
    const { error } = await supabase.from('foods').delete().eq('id', id);
    if (error) {
      Alert.alert('Nicht möglich', 'Dieses Lebensmittel wird noch in Tagebuch-Einträgen oder Rezepten verwendet und kann darum nicht gelöscht werden.');
      return;
    }
    setFoods((prev) => prev.filter((f) => f.id !== id));
  }

  const kcalOf = (e: LogEntry) => (e.food ? Math.round((e.food.kcal * e.amount_g) / 100) : 0);
  // Summen in EINEM Durchlauf (memoisiert) statt 4x ueber die Liste zu iterieren
  const { totalKcal, totalP, totalC, totalF } = useMemo(() => {
    let kcal = 0, p = 0, cc = 0, f = 0;
    for (const e of logs) {
      if (!e.food) continue;
      kcal += Math.round((e.food.kcal * e.amount_g) / 100);
      p += (e.food.protein * e.amount_g) / 100;
      cc += (e.food.carbs * e.amount_g) / 100;
      f += (e.food.fat * e.amount_g) / 100;
    }
    return { totalKcal: kcal, totalP: Math.round(p), totalC: Math.round(cc), totalF: Math.round(f) };
  }, [logs]);
  const remaining = targetKcal != null ? targetKcal - totalKcal : null;
  const filteredFoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? foods.filter((f) => f.name.toLowerCase().includes(q)) : foods;
  }, [foods, search]);

  if (loading) {
    return (<View style={[styles.container, embedded && styles.embedded]}>{!embedded && <Text style={styles.title}>Tracker</Text>}<ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} /></View>);
  }

  if (loadError) {
    return (
      <View style={[styles.container, embedded && styles.embedded]}>
        {!embedded && <Text style={styles.title}>Tracker</Text>}
        <ErrorRetry message={loadError} onRetry={() => init()} embedded={embedded} />
      </View>
    );
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={[styles.container, embedded && styles.embedded]} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => setMode('pick')}><Text style={styles.back}>‹ Zurück</Text></TouchableOpacity>
          <Text style={styles.title}>{selectedFood.name}</Text>
          <Text style={styles.subtitle}>{selectedFood.kcal} kcal / 100 g</Text>
          <Text style={styles.inputLabel}>Menge in Gramm</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" inputMode="decimal" placeholder="z. B. 150" placeholderTextColor={c.textMuted} returnKeyType="done" onSubmitEditing={addLog} />
          <Text style={styles.preview}>= {previewKcal} kcal</Text>
          <Text style={styles.inputLabel}>Mahlzeit</Text>
          <View style={styles.mealChips}>
            {TRACKER_MEALS.map((m) => (
              <TouchableOpacity key={m.key} style={[styles.mealChip, mealType === m.key && styles.mealChipActive]} onPress={() => setMealType(m.key)} activeOpacity={0.8}>
                <Text style={[styles.mealChipText, mealType === m.key && styles.mealChipTextActive]}>{m.icon} {m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={addLog} disabled={saving}>
            {saving ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.primaryText}>Zum Tagebuch hinzufügen</Text>}
          </TouchableOpacity>
          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (mode === 'newfood') {
    return (
      <ScrollView style={[styles.container, embedded && styles.embedded]} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => setMode('pick')}><Text style={styles.back}>‹ Zurück</Text></TouchableOpacity>
        <Text style={styles.title}>Neues Lebensmittel</Text>
        <Text style={styles.subtitle}>Nährwerte pro 100 g</Text>
        <Text style={styles.inputLabel}>Name</Text>
        <TextInput style={styles.input} value={nf.name} onChangeText={(v) => setNf({ ...nf, name: v })} placeholder="z. B. Mein Proteinriegel" placeholderTextColor={c.textMuted} />
        <Text style={styles.inputLabel}>Kategorie (optional)</Text>
        <TextInput style={styles.input} value={nf.cat} onChangeText={(v) => setNf({ ...nf, cat: v })} placeholder="z. B. Snacks & Süßes" placeholderTextColor={c.textMuted} />
        <Text style={styles.inputLabel}>Kalorien (kcal)</Text>
        <TextInput style={styles.input} value={nf.kcal} onChangeText={(v) => setNf({ ...nf, kcal: v })} keyboardType="numeric" placeholder="pro 100 g" placeholderTextColor={c.textMuted} />
        <View style={styles.macroRow}>
          <View style={styles.macroCol}>
            <Text style={styles.inputLabel}>Eiweiß (g)</Text>
            <TextInput style={styles.input} value={nf.protein} onChangeText={(v) => setNf({ ...nf, protein: v })} keyboardType="numeric" placeholder="0" placeholderTextColor={c.textMuted} />
          </View>
          <View style={styles.macroCol}>
            <Text style={styles.inputLabel}>KH (g)</Text>
            <TextInput style={styles.input} value={nf.carbs} onChangeText={(v) => setNf({ ...nf, carbs: v })} keyboardType="numeric" placeholder="0" placeholderTextColor={c.textMuted} />
          </View>
          <View style={styles.macroCol}>
            <Text style={styles.inputLabel}>Fett (g)</Text>
            <TextInput style={styles.input} value={nf.fat} onChangeText={(v) => setNf({ ...nf, fat: v })} keyboardType="numeric" placeholder="0" placeholderTextColor={c.textMuted} />
          </View>
        </View>
        <TouchableOpacity style={[styles.primaryBtn, savingFood && { opacity: 0.6 }]} onPress={saveFood} disabled={savingFood}>
          {savingFood ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.primaryText}>Speichern & auswählen</Text>}
        </TouchableOpacity>
        {foodErr && <Text style={styles.error}>{foodErr}</Text>}
      </ScrollView>
    );
  }

  if (mode === 'pick') {
    return (
      <View style={[styles.container, embedded && styles.embedded]}>
        <TouchableOpacity onPress={() => { setMode('diary'); setSearch(''); }}><Text style={styles.back}>‹ Zurück</Text></TouchableOpacity>
        <Text style={styles.title}>Zutat auswählen</Text>
        <View style={styles.allergyNote}><Text style={styles.allergyText}>{ALLERGY_HINT}</Text></View>
        <TextInput style={styles.input} value={search} onChangeText={setSearch} placeholder="Suchen (z. B. Banane)…" placeholderTextColor={c.textMuted} autoCorrect={false} />
        <TouchableOpacity style={styles.newFoodBtn} onPress={openNewFood} activeOpacity={0.85}>
          <Text style={styles.newFoodText}>➕  Eigenes Lebensmittel anlegen</Text>
        </TouchableOpacity>
        <Text style={styles.countHint}>{filteredFoods.length} Zutaten</Text>
        <FlatList
          style={{ flex: 1 }}
          data={filteredFoods}
          keyExtractor={(f) => f.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
          initialNumToRender={15}
          maxToRenderPerBatch={20}
          windowSize={10}
          removeClippedSubviews
          renderItem={({ item: f }) => {
            const own = !!userId && f.user_id === userId;
            return (
              <TouchableOpacity style={styles.foodRow} onPress={() => { setSelectedFood(f); setAmount('100'); setError(null); setMode('amount'); }} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.foodName}>{f.name}</Text>
                  <Text style={styles.foodMeta}>{f.category}{own ? '  ·  eigenes' : ''}</Text>
                </View>
                <Text style={styles.foodKcal}>{f.kcal} kcal</Text>
                {own && (
                  <TouchableOpacity onPress={() => confirmDeleteFood(f)} style={styles.foodDel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={`${f.name} löschen`}>
                    <Text style={styles.foodDelText}>🗑</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={styles.noResult}>Kein Treffer{search.trim() ? ` für „${search.trim()}"` : ''}. Leg es als eigenes Lebensmittel an ☝️</Text>}
        />
      </View>
    );
  }

  return (
    <>
    <ScrollView
      style={[styles.container, embedded && styles.embedded]}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
    >
      {!embedded && <Text style={styles.title}>Tracker</Text>}
      {!embedded && <Text style={styles.subtitle}>Dein Essens-Tagebuch für heute</Text>}

      {/* HEUTE-Übersicht */}
      <View style={styles.todayCard}>
        <View style={styles.todayRow}>
          <View style={styles.todayCol}><Text style={styles.todayVal}>{totalKcal}</Text><Text style={styles.todayLbl}>gegessen</Text></View>
          <View style={styles.todaySep} />
          <View style={styles.todayCol}><Text style={styles.todayVal}>{targetKcal ?? '–'}</Text><Text style={styles.todayLbl}>Ziel</Text></View>
          <View style={styles.todaySep} />
          <View style={styles.todayCol}><Text style={[styles.todayVal, remaining != null && remaining < 0 && { color: c.danger }]}>{remaining != null ? remaining : '–'}</Text><Text style={styles.todayLbl}>übrig</Text></View>
        </View>
        {targetKcal != null && (
          <View style={styles.kcalTrack}>
            <View style={[styles.kcalFill, { width: `${Math.min(100, Math.round((totalKcal / targetKcal) * 100))}%`, backgroundColor: totalKcal > targetKcal ? c.danger : c.primary }]} />
          </View>
        )}
        <View style={styles.macrosRow}>
          <View style={styles.macroItem}><View style={[styles.macroDot, { backgroundColor: c.accent }]} /><Text style={styles.macroTxt}>{totalP} g Eiweiß</Text></View>
          <View style={styles.macroItem}><View style={[styles.macroDot, { backgroundColor: '#E69500' }]} /><Text style={styles.macroTxt}>{totalC} g KH</Text></View>
          <View style={styles.macroItem}><View style={[styles.macroDot, { backgroundColor: c.danger }]} /><Text style={styles.macroTxt}>{totalF} g Fett</Text></View>
        </View>
      </View>

      <Text style={styles.disclaimer}>{NUTRITION_DISCLAIMER}</Text>

      {/* Aktionen */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.addBtnRow} onPress={() => { setMealType(mealByHour()); setError(null); setMode('pick'); }} activeOpacity={0.85}>
          <Text style={styles.addText}>➕  Hinzufügen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.scanBtn} onPress={() => { setError(null); setScannerOpen(true); }} activeOpacity={0.85}>
          <Text style={styles.scanText}>📷  Scannen</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.allergyNote}><Text style={styles.allergyText}>{ALLERGY_HINT}</Text></View>

      {/* Schnellzugriff */}
      {quickFoods.length > 0 && (
        <View style={styles.quickWrap}>
          <Text style={styles.sectionHead}>SCHNELLZUGRIFF</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }} keyboardShouldPersistTaps="handled">
            {quickFoods.map((qf) => (
              <TouchableOpacity key={qf.food.id} style={styles.quickChip} onPress={() => quickAdd(qf)} activeOpacity={0.8}>
                <Text style={styles.quickName} numberOfLines={1}>{qf.food.name}</Text>
                <Text style={styles.quickMeta}>+{qf.amount} g · {Math.round((qf.food.kcal * qf.amount) / 100)} kcal</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {quickMsg && <Text style={styles.quickMsg}>{quickMsg}</Text>}
        </View>
      )}

      {/* Mahlzeiten */}
      {TRACKER_MEALS.map((m) => {
        const items = logs.filter((e) => normalizeMeal(e.meal_type) === m.key);
        const mealKcal = items.reduce((s, e) => s + kcalOf(e), 0);
        return (
          <View key={m.key} style={styles.mealCard}>
            <View style={styles.mealHeader}>
              <Text style={styles.mealTitle}>{m.icon}  {m.label}</Text>
              <View style={styles.mealHeaderRight}>
                {mealKcal > 0 && <Text style={styles.mealKcal}>{mealKcal} kcal</Text>}
                <TouchableOpacity style={styles.mealAdd} onPress={() => { setMealType(m.key); setError(null); setMode('pick'); }} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={`Zu ${m.label} hinzufügen`}>
                  <Text style={styles.mealAddText}>＋</Text>
                </TouchableOpacity>
              </View>
            </View>
            {items.length === 0 ? (
              <Text style={styles.mealEmpty}>Noch nichts – tippe ＋</Text>
            ) : (
              items.map((e, idx) => (
                <View key={e.id} style={[styles.entryRow, idx > 0 && styles.entryDivider]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryName} numberOfLines={1}>{e.food?.name ?? '—'}</Text>
                    <Text style={styles.entryMeta}>{e.amount_g} g</Text>
                  </View>
                  <Text style={styles.entryKcal}>{kcalOf(e)} kcal</Text>
                  <TouchableOpacity onPress={() => deleteLog(e.id)} style={styles.del} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={`${e.food?.name ?? 'Eintrag'} aus dem Tagebuch entfernen`}><Text style={styles.delText}>✕</Text></TouchableOpacity>
                </View>
              ))
            )}
          </View>
        );
      })}
      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
    <BarcodeScanner visible={scannerOpen} c={c} onClose={() => setScannerOpen(false)} onScanned={handleScanned} />
    </>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 56, paddingHorizontal: 16 },
    embedded: { paddingTop: 4, paddingHorizontal: 0, backgroundColor: 'transparent' },
    title: { fontSize: 26, fontWeight: '800', color: c.heading },
    subtitle: { fontSize: 15, color: c.textMuted, marginTop: 2, marginBottom: 16 },
    disclaimer: { fontSize: 12, color: c.textMuted, lineHeight: 17, marginTop: 2, marginBottom: 14 },
    allergyNote: { backgroundColor: c.inputBg, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: c.cardBorder, marginBottom: 14 },
    allergyText: { fontSize: 13, color: c.text, lineHeight: 18, fontWeight: '600' },
    back: { color: c.primary, fontSize: 15, fontWeight: '600', marginBottom: 10 },
    addText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
    actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    addBtnRow: { flex: 1, backgroundColor: c.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
    scanBtn: { flex: 1, backgroundColor: c.card, borderWidth: 1, borderColor: c.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
    scanText: { color: c.primary, fontSize: 16, fontWeight: '700' },
    quickWrap: { marginBottom: 18 },
    quickChip: { ...shadow, backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, maxWidth: 200 },
    quickName: { fontSize: 14, fontWeight: '700', color: c.heading },
    quickMeta: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    quickMsg: { fontSize: 13, color: c.success, marginTop: 10, fontWeight: '600' },
    sectionHead: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, color: c.textMuted, marginBottom: 8, marginLeft: 2 },

    todayCard: { ...shadow, backgroundColor: c.card, borderRadius: 16, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: c.cardBorder },
    todayRow: { flexDirection: 'row', alignItems: 'center' },
    todayCol: { flex: 1, alignItems: 'center' },
    todayVal: { fontSize: 24, fontWeight: 'bold', color: c.heading },
    todayLbl: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    todaySep: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: c.border },
    kcalTrack: { height: 8, backgroundColor: c.track, borderRadius: 4, overflow: 'hidden', marginTop: 14 },
    kcalFill: { height: 8, borderRadius: 4 },
    macrosRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
    macroItem: { flexDirection: 'row', alignItems: 'center' },
    macroDot: { width: 9, height: 9, borderRadius: 5, marginRight: 6 },
    macroTxt: { fontSize: 13, color: c.text, fontWeight: '600' },

    mealCard: { ...shadow, backgroundColor: c.card, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 12, borderWidth: 1, borderColor: c.cardBorder },
    entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    entryDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    entryName: { fontSize: 15, color: c.text, fontWeight: '600' },
    entryMeta: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    entryKcal: { fontSize: 14, color: c.heading, fontWeight: '700', marginRight: 10 },
    del: { padding: 4 },
    delText: { fontSize: 16, color: c.textMuted },
    mealChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    mealChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border },
    mealChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    mealChipText: { fontSize: 14, fontWeight: '600', color: c.text },
    mealChipTextActive: { color: c.onPrimary },
    mealHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    mealTitle: { fontSize: 16, fontWeight: '700', color: c.heading },
    mealHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    mealKcal: { fontSize: 13, fontWeight: '700', color: c.textMuted },
    mealAdd: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    mealAddText: { fontSize: 16, color: c.primary, fontWeight: '700', lineHeight: 18 },
    mealEmpty: { fontSize: 13, color: c.textMuted, fontStyle: 'italic', paddingVertical: 6, paddingLeft: 2 },
    inputLabel: { fontSize: 14, color: c.text, fontWeight: '600', marginTop: 8, marginBottom: 6 },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, backgroundColor: c.inputBg, color: c.text },
    preview: { fontSize: 18, fontWeight: '700', color: c.heading, marginTop: 14 },
    primaryBtn: { backgroundColor: c.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
    primaryText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
    countHint: { fontSize: 12, color: c.textMuted, marginTop: 8, marginBottom: 4 },
    foodRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: c.cardBorder },
    foodName: { fontSize: 16, color: c.text, fontWeight: '600' },
    foodMeta: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    foodKcal: { fontSize: 14, color: c.primary, fontWeight: '700', marginLeft: 8 },
    foodDel: { paddingHorizontal: 6, paddingVertical: 4, marginLeft: 6 },
    foodDelText: { fontSize: 16 },
    newFoodBtn: { borderWidth: 1, borderColor: c.primary, borderRadius: 16, paddingVertical: 13, alignItems: 'center', marginTop: 10, backgroundColor: c.card },
    newFoodText: { color: c.primary, fontSize: 15, fontWeight: '700' },
    noResult: { fontSize: 14, color: c.textMuted, textAlign: 'center', marginTop: 18, lineHeight: 20 },
    macroRow: { flexDirection: 'row', gap: 10 },
    macroCol: { flex: 1 },
    error: { color: c.danger, fontSize: 14, marginTop: 14, textAlign: 'center' },
  });
}
