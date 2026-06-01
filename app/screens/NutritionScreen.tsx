// Ernährungsplan (themed): Tagesplan, der Kalorien/Makros trifft und Allergien ausschließt.
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { computeNutrition, ageFromBirthDate, NutritionResult, Gender, ActivityLevel, GoalType } from '../lib/nutrition';
import { generateMealPlan, recipeFor, MEAL_TYPE_LABELS, MealType } from '../lib/meals';

type LoadedMeal = { id: string; meal_type: string; name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number };
const TYPE_RANK: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };

export default function NutritionScreen({ embedded }: { embedded?: boolean }) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const c = useColors();
  const styles = makeStyles(c);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<NutritionResult | null>(null);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [meals, setMeals] = useState<LoadedMeal[]>([]);
  const [selMeal, setSelMeal] = useState<LoadedMeal | null>(null);

  useEffect(() => { loadAll(); }, [userId]);

  async function fetchCurrentMeals(uid: string): Promise<LoadedMeal[]> {
    const { data: plan } = await supabase.from('nutrition_plans').select('id').eq('user_id', uid).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!plan) return [];
    const { data: ms } = await supabase.from('meals').select('id, meal_type, name, calories, protein_g, carbs_g, fat_g').eq('nutrition_plan_id', plan.id);
    return ((ms ?? []) as LoadedMeal[]).slice().sort((a, b) => (TYPE_RANK[a.meal_type] ?? 9) - (TYPE_RANK[b.meal_type] ?? 9));
  }

  async function loadAll() {
    if (!userId) { setLoading(false); return; }
    setLoading(true); setError(null);
    const { data: prof } = await supabase.from('profiles').select('weight_kg, height_cm, birth_date, gender, activity_level, allergies').eq('id', userId).maybeSingle();
    const { data: goal } = await supabase.from('goals').select('goal_type').eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (prof && prof.weight_kg && prof.height_cm) {
      setTargets(computeNutrition({
        weightKg: Number(prof.weight_kg), heightCm: Number(prof.height_cm), age: ageFromBirthDate(prof.birth_date),
        gender: (prof.gender ?? 'prefer_not') as Gender, activity: (prof.activity_level ?? 'moderate') as ActivityLevel, goal: (goal?.goal_type ?? 'general_fitness') as GoalType,
      }));
      setAllergies(Array.isArray(prof.allergies) ? prof.allergies : []);
    } else {
      setError('Profildaten unvollständig – bitte zuerst das Onboarding abschließen.');
    }
    setMeals(await fetchCurrentMeals(userId));
    setLoading(false);
  }

  async function generate() {
    if (!userId || !targets) { setError('Keine Zieldaten vorhanden.'); return; }
    setGenerating(true); setError(null);
    try {
      const planned = generateMealPlan(targets.targetCalories, allergies);
      await supabase.from('nutrition_plans').delete().eq('user_id', userId);
      const { data: plan, error: pErr } = await supabase.from('nutrition_plans').insert({
        user_id: userId, calories_target: targets.targetCalories, protein_g: targets.proteinG, carbs_g: targets.carbsG, fat_g: targets.fatG,
      }).select('id').single();
      if (pErr || !plan) throw pErr ?? new Error('Plan konnte nicht erstellt werden.');
      if (planned.length) {
        const rows = planned.map((p) => ({ user_id: userId, nutrition_plan_id: plan.id, meal_type: p.type, name: p.name, calories: p.kcal, protein_g: p.protein, carbs_g: p.carbs, fat_g: p.fat }));
        const { error: mErr } = await supabase.from('meals').insert(rows);
        if (mErr) throw mErr;
      }
      setMeals(await fetchCurrentMeals(userId));
    } catch (e: any) {
      setError(e?.message ?? 'Fehler bei der Plan-Erstellung.');
    } finally {
      setGenerating(false);
    }
  }

  const totals = meals.reduce((acc, m) => ({ kcal: acc.kcal + (m.calories ?? 0), p: acc.p + (m.protein_g ?? 0), c: acc.c + (m.carbs_g ?? 0), f: acc.f + (m.fat_g ?? 0) }), { kcal: 0, p: 0, c: 0, f: 0 });

  if (loading) {
    return (<View style={[styles.container, embedded && styles.embedded]}>{!embedded && <Text style={styles.title}>Ernährungsplan</Text>}<ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} /></View>);
  }

  if (selMeal) {
    const items = recipeFor(selMeal.name, selMeal.calories);
    return (
      <ScrollView style={[styles.container, embedded && styles.embedded]} contentContainerStyle={{ paddingBottom: 40 }}>
        <TouchableOpacity onPress={() => setSelMeal(null)}><Text style={styles.back}>‹ Zurück</Text></TouchableOpacity>
        <Text style={styles.recipeType}>{MEAL_TYPE_LABELS[selMeal.meal_type as MealType] ?? selMeal.meal_type}</Text>
        <Text style={styles.recipeName}>{selMeal.name}</Text>
        <Text style={styles.mealMeta}>{selMeal.calories} kcal · {selMeal.protein_g} g P · {selMeal.carbs_g} g KH · {selMeal.fat_g} g F</Text>
        <Text style={styles.h2}>Zutaten</Text>
        {items.length > 0 ? (
          items.map((it, i) => (
            <View key={i} style={styles.ingRow}>
              <Text style={styles.ingName}>{it.name}</Text>
              <Text style={styles.ingAmt}>{it.g} g</Text>
            </View>
          ))
        ) : (
          <Text style={styles.hint}>Für dieses Gericht sind keine Zutaten hinterlegt.</Text>
        )}
        <Text style={styles.recipeNote}>Mengen für 1 Portion, an dein Tagesziel angepasst. Zutaten sind frei austauschbar. 🍳</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, embedded && styles.embedded]} contentContainerStyle={{ paddingBottom: 40 }}>
      {!embedded && <Text style={styles.title}>Ernährungsplan</Text>}
      {targets && (
        <View style={styles.targetCard}>
          <Text style={styles.targetLabel}>DEIN TAGESZIEL</Text>
          <Text style={styles.targetKcal}>{targets.targetCalories.toLocaleString('de-DE')} kcal</Text>
          <Text style={styles.targetMacros}>{targets.proteinG} g Protein · {targets.carbsG} g KH · {targets.fatG} g Fett</Text>
        </View>
      )}
      {meals.length === 0 ? (
        <>
          <TouchableOpacity style={[styles.primaryBtn, generating && { opacity: 0.6 }]} onPress={generate} disabled={generating || !targets}>
            {generating ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.primaryText}>Plan für heute erstellen</Text>}
          </TouchableOpacity>
          <Text style={styles.hint}>Die Mahlzeiten werden an deine Kalorien/Makros angepasst und schließen deine Allergien aus{allergies.length > 0 ? ` (${allergies.length} berücksichtigt)` : ''}.</Text>
        </>
      ) : (
        <>
          {meals.map((m) => (
            <TouchableOpacity key={m.id} style={styles.mealCard} onPress={() => setSelMeal(m)} activeOpacity={0.7}>
              <Text style={styles.mealType}>{MEAL_TYPE_LABELS[m.meal_type as MealType] ?? m.meal_type}</Text>
              <Text style={styles.mealName}>{m.name}</Text>
              <Text style={styles.mealMeta}>{m.calories} kcal · {m.protein_g} g P · {m.carbs_g} g KH · {m.fat_g} g F</Text>
              <Text style={styles.recipeLink}>Rezept ansehen ›</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Tagessumme</Text>
            <Text style={styles.totalKcal}>{totals.kcal.toLocaleString('de-DE')} kcal</Text>
            <Text style={styles.totalMeta}>{totals.p} g P · {totals.c} g KH · {totals.f} g F{targets ? `   (Ziel: ${targets.targetCalories.toLocaleString('de-DE')} kcal)` : ''}</Text>
          </View>
          <TouchableOpacity style={[styles.secondaryBtn, generating && { opacity: 0.6 }]} onPress={generate} disabled={generating}>
            {generating ? <ActivityIndicator color={c.primary} /> : <Text style={styles.secondaryText}>Neu generieren</Text>}
          </TouchableOpacity>
        </>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <Text style={styles.disclaimer}>Vorschlag auf Basis deiner Angaben – keine medizinische oder ärztliche Ernährungsberatung.</Text>
    </ScrollView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 60, paddingHorizontal: 20 },
    embedded: { paddingTop: 8, paddingHorizontal: 0, backgroundColor: 'transparent' },
    title: { fontSize: 26, fontWeight: 'bold', color: c.heading, marginBottom: 16 },
    targetCard: { backgroundColor: c.hero, borderRadius: 16, padding: 18, marginBottom: 16, alignItems: 'center' },
    targetLabel: { color: '#A9B8D6', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
    targetKcal: { color: '#fff', fontSize: 30, fontWeight: 'bold', marginTop: 4 },
    targetMacros: { color: '#D6DEEE', fontSize: 14, marginTop: 4 },
    primaryBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
    primaryText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
    secondaryBtn: { borderWidth: 1, borderColor: c.border, backgroundColor: c.card, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
    secondaryText: { color: c.primary, fontSize: 15, fontWeight: '600' },
    hint: { fontSize: 13, color: c.textMuted, marginTop: 14, lineHeight: 18 },
    mealCard: { backgroundColor: c.card, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    mealType: { fontSize: 12, color: c.textMuted, fontWeight: '700', letterSpacing: 0.5 },
    mealName: { fontSize: 17, fontWeight: '600', color: c.text, marginTop: 2 },
    mealMeta: { fontSize: 13, color: c.textMuted, marginTop: 4 },
    recipeLink: { fontSize: 13, color: c.primary, fontWeight: '700', marginTop: 8 },
    back: { color: c.primary, fontSize: 15, fontWeight: '600', marginBottom: 10 },
    recipeType: { fontSize: 12, color: c.textMuted, fontWeight: '700', letterSpacing: 0.5 },
    recipeName: { fontSize: 24, fontWeight: 'bold', color: c.heading, marginTop: 2, marginBottom: 6 },
    h2: { fontSize: 17, fontWeight: '700', color: c.heading, marginTop: 18, marginBottom: 10 },
    ingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    ingName: { fontSize: 16, color: c.text, flex: 1, marginRight: 10 },
    ingAmt: { fontSize: 16, color: c.primary, fontWeight: '700' },
    recipeNote: { fontSize: 13, color: c.textMuted, marginTop: 16, lineHeight: 19 },
    totalCard: { backgroundColor: c.inputBg, borderRadius: 14, padding: 16, marginTop: 4, marginBottom: 12, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    totalLabel: { fontSize: 12, color: c.primary, fontWeight: '700', letterSpacing: 0.5 },
    totalKcal: { fontSize: 22, fontWeight: 'bold', color: c.heading, marginTop: 2 },
    totalMeta: { fontSize: 13, color: c.textMuted, marginTop: 4 },
    error: { color: c.danger, fontSize: 14, marginTop: 14, textAlign: 'center' },
    disclaimer: { fontSize: 12, color: c.textMuted, textAlign: 'center', marginTop: 18, lineHeight: 17 },
  });
}
