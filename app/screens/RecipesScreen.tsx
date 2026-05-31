// Eigene Rezepte/Mahlzeiten: aus mehreren Zutaten zusammenstellen, speichern und
// mit einem Tipp komplett ins Essens-Tagebuch (food_logs) eintragen.
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';

type Food = { id: string; name: string; category: string | null; kcal: number; protein: number; carbs: number; fat: number };
type Item = { food: Food; amount_g: number };
type Recipe = { id: string; name: string; items: { amount_g: number; food: Food | null }[] };

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const kcalOf = (items: { amount_g: number; food: Food | null }[]) =>
  Math.round(items.reduce((s, i) => s + (i.food ? (i.food.kcal * i.amount_g) / 100 : 0), 0));

export default function RecipesScreen({ embedded }: { embedded?: boolean }) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const c = useColors();
  const styles = makeStyles(c);

  const [loading, setLoading] = useState(true);
  const [foods, setFoods] = useState<Food[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [msg, setMsg] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { init(); }, [userId]);

  async function init() {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data: f } = await supabase.from('foods').select('id, name, category, kcal, protein, carbs, fat').order('name');
    setFoods((f ?? []) as Food[]);
    await loadRecipes();
    setLoading(false);
  }

  async function loadRecipes() {
    if (!userId) return;
    const { data } = await supabase
      .from('recipes')
      .select('id, name, recipe_items(amount_g, foods(id, name, category, kcal, protein, carbs, fat))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setRecipes(((data ?? []) as any[]).map((r) => ({
      id: r.id, name: r.name,
      items: (r.recipe_items ?? []).map((it: any) => ({ amount_g: it.amount_g, food: Array.isArray(it.foods) ? it.foods[0] : it.foods })),
    })));
  }

  async function trackRecipe(r: Recipe) {
    if (!userId) return;
    const rows = r.items.filter((i) => i.food).map((i) => ({ user_id: userId, food_id: i.food!.id, amount_g: i.amount_g, log_date: todayStr() }));
    if (!rows.length) return;
    const { error } = await supabase.from('food_logs').insert(rows);
    setMsg(error ? 'Fehler: ' + error.message : `„${r.name}" zum Tagebuch hinzugefügt ✓`);
  }

  async function deleteRecipe(id: string) {
    await supabase.from('recipes').delete().eq('id', id);
    await loadRecipes();
  }

  async function saveRecipe() {
    if (!userId) return;
    if (!name.trim() || !items.length) { setMsg('Bitte einen Namen und mindestens eine Zutat angeben.'); return; }
    setSaving(true); setMsg(null);
    const { data: rec, error } = await supabase.from('recipes').insert({ user_id: userId, name: name.trim() }).select('id').single();
    if (error || !rec) { setSaving(false); setMsg('Fehler: ' + (error?.message ?? '')); return; }
    const rows = items.map((i) => ({ user_id: userId, recipe_id: rec.id, food_id: i.food.id, amount_g: i.amount_g }));
    const { error: e2 } = await supabase.from('recipe_items').insert(rows);
    setSaving(false);
    if (e2) { setMsg('Fehler: ' + e2.message); return; }
    setName(''); setItems([]); setMode('list'); setMsg('Rezept gespeichert ✓');
    await loadRecipes();
  }

  const filtered = search.trim() ? foods.filter((f) => f.name.toLowerCase().includes(search.trim().toLowerCase())) : foods;

  if (loading) {
    return (<View style={[styles.container, embedded && styles.embedded]}>{!embedded && <Text style={styles.title}>Rezepte</Text>}<ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} /></View>);
  }

  // Zutat auswählen (innerhalb "create")
  if (mode === 'create' && picking) {
    return (
      <View style={[styles.container, embedded && styles.embedded]}>
        <TouchableOpacity onPress={() => { setPicking(false); setSearch(''); }}><Text style={styles.back}>‹ Zurück</Text></TouchableOpacity>
        <Text style={styles.h2}>Zutat hinzufügen</Text>
        <TextInput style={styles.input} value={search} onChangeText={setSearch} placeholder="Suchen (z. B. Banane)…" placeholderTextColor={c.textMuted} autoCorrect={false} />
        <Text style={styles.countHint}>{filtered.length} Zutaten</Text>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {filtered.slice(0, 80).map((f) => (
            <TouchableOpacity key={f.id} style={styles.foodRow} activeOpacity={0.7}
              onPress={() => { setItems((p) => [...p, { food: f, amount_g: 100 }]); setPicking(false); setSearch(''); }}>
              <View style={{ flex: 1 }}><Text style={styles.foodName}>{f.name}</Text><Text style={styles.foodMeta}>{f.category}</Text></View>
              <Text style={styles.foodKcal}>{f.kcal} kcal</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // Rezept erstellen
  if (mode === 'create') {
    return (
      <ScrollView style={[styles.container, embedded && styles.embedded]} contentContainerStyle={{ paddingBottom: 40 }}>
        <TouchableOpacity onPress={() => { setMode('list'); setMsg(null); }}><Text style={styles.back}>‹ Rezepte</Text></TouchableOpacity>
        {!embedded && <Text style={styles.title}>Neues Rezept</Text>}
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="z. B. Mein Frühstück" placeholderTextColor={c.textMuted} />

        <Text style={[styles.label, { marginTop: 16 }]}>Zutaten</Text>
        {items.length === 0 ? (
          <Text style={styles.muted}>Noch keine Zutaten – füge welche hinzu.</Text>
        ) : (
          items.map((it, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemName} numberOfLines={1}>{it.food.name}</Text>
              <TextInput
                style={styles.amountInput}
                value={String(it.amount_g)}
                onChangeText={(v) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, amount_g: Number(v.replace(',', '.')) || 0 } : x)))}
                keyboardType="numeric"
              />
              <Text style={styles.gLabel}>g</Text>
              <TouchableOpacity onPress={() => setItems((p) => p.filter((_, i) => i !== idx))} style={styles.del}><Text style={styles.delText}>✕</Text></TouchableOpacity>
            </View>
          ))
        )}

        <TouchableOpacity style={styles.addBtn} onPress={() => { setPicking(true); setSearch(''); }}>
          <Text style={styles.addText}>+ Zutat hinzufügen</Text>
        </TouchableOpacity>

        {items.length > 0 && <Text style={styles.totalLine}>Gesamt: {kcalOf(items)} kcal</Text>}

        <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={saveRecipe} disabled={saving}>
          {saving ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.primaryText}>Rezept speichern</Text>}
        </TouchableOpacity>
        {msg && <Text style={styles.msg}>{msg}</Text>}
      </ScrollView>
    );
  }

  // Liste
  return (
    <ScrollView style={[styles.container, embedded && styles.embedded]} contentContainerStyle={{ paddingBottom: 40 }}>
      {!embedded && <Text style={styles.title}>Rezepte</Text>}
      <Text style={styles.subtitle}>Eigene Mahlzeiten speichern & mit einem Tipp tracken</Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={() => { setMode('create'); setName(''); setItems([]); setMsg(null); }}>
        <Text style={styles.primaryText}>+ Neues Rezept</Text>
      </TouchableOpacity>
      {msg && <Text style={styles.msg}>{msg}</Text>}
      {recipes.length === 0 ? (
        <Text style={styles.empty}>Noch keine Rezepte. Erstelle dein erstes! 🍳</Text>
      ) : (
        recipes.map((r) => (
          <View key={r.id} style={styles.recipeCard}>
            <View style={styles.recipeTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recipeName}>{r.name}</Text>
                <Text style={styles.recipeMeta}>{r.items.length} Zutaten · {kcalOf(r.items)} kcal</Text>
              </View>
              <TouchableOpacity onPress={() => deleteRecipe(r.id)} style={styles.del}><Text style={styles.delText}>🗑</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.trackBtn} onPress={() => trackRecipe(r)} activeOpacity={0.85}>
              <Text style={styles.trackText}>+ Zum Tagebuch hinzufügen</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 60, paddingHorizontal: 20 },
    embedded: { paddingTop: 8, paddingHorizontal: 0, backgroundColor: 'transparent' },
    title: { fontSize: 26, fontWeight: 'bold', color: c.heading },
    subtitle: { fontSize: 14, color: c.textMuted, marginTop: 2, marginBottom: 14 },
    back: { color: c.primary, fontSize: 15, fontWeight: '600', marginBottom: 10 },
    h2: { fontSize: 18, fontWeight: '700', color: c.heading, marginBottom: 10 },
    label: { fontSize: 14, color: c.text, fontWeight: '600', marginBottom: 6 },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: c.inputBg, color: c.text },
    muted: { fontSize: 14, color: c.textMuted, fontStyle: 'italic', marginBottom: 4 },
    itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    itemName: { flex: 1, fontSize: 15, color: c.text, marginRight: 8 },
    amountInput: { width: 64, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 15, backgroundColor: c.inputBg, color: c.text, textAlign: 'right' },
    gLabel: { fontSize: 14, color: c.textMuted, marginLeft: 4, marginRight: 4 },
    del: { padding: 6 },
    delText: { fontSize: 16, color: c.textMuted },
    addBtn: { borderWidth: 1, borderColor: c.border, backgroundColor: c.card, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 6 },
    addText: { color: c.primary, fontSize: 15, fontWeight: '600' },
    totalLine: { fontSize: 14, color: c.text, fontWeight: '700', marginTop: 14, textAlign: 'center' },
    primaryBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
    primaryText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
    msg: { color: c.success, textAlign: 'center', marginTop: 12, fontSize: 14 },
    empty: { fontSize: 14, color: c.textMuted, textAlign: 'center', marginTop: 18 },
    recipeCard: { backgroundColor: c.card, borderRadius: 14, padding: 16, marginTop: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    recipeTop: { flexDirection: 'row', alignItems: 'center' },
    recipeName: { fontSize: 17, fontWeight: '700', color: c.heading },
    recipeMeta: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    trackBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 12 },
    trackText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
    countHint: { fontSize: 12, color: c.textMuted, marginTop: 8, marginBottom: 4 },
    foodRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    foodName: { fontSize: 16, color: c.text, fontWeight: '600' },
    foodMeta: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    foodKcal: { fontSize: 14, color: c.primary, fontWeight: '700', marginLeft: 8 },
  });
}
