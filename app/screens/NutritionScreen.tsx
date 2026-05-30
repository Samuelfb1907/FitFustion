// Ernährungsplan: erzeugt einen Tagesplan (Frühstück/Mittag/Abend/Snack), der die
// berechneten Kalorien/Makros ungefähr trifft und die Allergien des Nutzers ausschließt.
// Speichert in nutrition_plans / meals.
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { computeNutrition, ageFromBirthDate, NutritionResult, Gender, ActivityLevel, GoalType } from '../lib/nutrition';
import { generateMealPlan, MEAL_TYPE_LABELS, MealType } from '../lib/meals';

type LoadedMeal = {
  id: string;
  meal_type: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

const TYPE_RANK: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };

export default function NutritionScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<NutritionResult | null>(null);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [meals, setMeals] = useState<LoadedMeal[]>([]);

  useEffect(() => {
    loadAll();
  }, [userId]);

  async function fetchCurrentMeals(uid: string): Promise<LoadedMeal[]> {
    const { data: plan } = await supabase
      .from('nutrition_plans')
      .select('id')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!plan) return [];
    const { data: ms } = await supabase
      .from('meals')
      .select('id, meal_type, name, calories, protein_g, carbs_g, fat_g')
      .eq('nutrition_plan_id', plan.id);
    return ((ms ?? []) as LoadedMeal[])
      .slice()
      .sort((a, b) => (TYPE_RANK[a.meal_type] ?? 9) - (TYPE_RANK[b.meal_type] ?? 9));
  }

  async function loadAll() {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const { data: prof } = await supabase
      .from('profiles')
      .select('weight_kg, height_cm, birth_date, gender, activity_level, allergies')
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
      setTargets(t);
      setAllergies(Array.isArray(prof.allergies) ? prof.allergies : []);
    } else {
      setError('Profildaten unvollständig – bitte zuerst das Onboarding abschließen.');
    }

    setMeals(await fetchCurrentMeals(userId));
    setLoading(false);
  }

  async function generate() {
    if (!userId || !targets) {
      setError('Keine Zieldaten vorhanden.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const planned = generateMealPlan(targets.targetCalories, allergies);

      // Alten Plan ersetzen (meals werden per Fremdschlüssel mitgelöscht)
      await supabase.from('nutrition_plans').delete().eq('user_id', userId);

      const { data: plan, error: pErr } = await supabase
        .from('nutrition_plans')
        .insert({
          user_id: userId,
          calories_target: targets.targetCalories,
          protein_g: targets.proteinG,
          carbs_g: targets.carbsG,
          fat_g: targets.fatG,
        })
        .select('id')
        .single();
      if (pErr || !plan) throw pErr ?? new Error('Plan konnte nicht erstellt werden.');

      if (planned.length) {
        const rows = planned.map((p) => ({
          user_id: userId,
          nutrition_plan_id: plan.id,
          meal_type: p.type,
          name: p.name,
          calories: p.kcal,
          protein_g: p.protein,
          carbs_g: p.carbs,
          fat_g: p.fat,
        }));
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

  const totals = meals.reduce(
    (acc, m) => ({
      kcal: acc.kcal + (m.calories ?? 0),
      p: acc.p + (m.protein_g ?? 0),
      c: acc.c + (m.carbs_g ?? 0),
      f: acc.f + (m.fat_g ?? 0),
    }),
    { kcal: 0, p: 0, c: 0, f: 0 }
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Ernährungsplan</Text>
        <ActivityIndicator size="large" color="#1F3864" style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Ernährungsplan</Text>

      {targets && (
        <View style={styles.targetCard}>
          <Text style={styles.targetLabel}>DEIN TAGESZIEL</Text>
          <Text style={styles.targetKcal}>{targets.targetCalories.toLocaleString('de-DE')} kcal</Text>
          <Text style={styles.targetMacros}>
            {targets.proteinG} g Protein · {targets.carbsG} g KH · {targets.fatG} g Fett
          </Text>
        </View>
      )}

      {meals.length === 0 ? (
        <>
          <TouchableOpacity style={[styles.primaryBtn, generating && { opacity: 0.6 }]} onPress={generate} disabled={generating || !targets}>
            {generating ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Plan für heute erstellen</Text>}
          </TouchableOpacity>
          <Text style={styles.hint}>
            Die Mahlzeiten werden an deine Kalorien/Makros angepasst und schließen deine Allergien aus
            {allergies.length > 0 ? ` (${allergies.length} berücksichtigt)` : ''}.
          </Text>
        </>
      ) : (
        <>
          {meals.map((m) => (
            <View key={m.id} style={styles.mealCard}>
              <Text style={styles.mealType}>{MEAL_TYPE_LABELS[m.meal_type as MealType] ?? m.meal_type}</Text>
              <Text style={styles.mealName}>{m.name}</Text>
              <Text style={styles.mealMeta}>
                {m.calories} kcal · {m.protein_g} g P · {m.carbs_g} g KH · {m.fat_g} g F
              </Text>
            </View>
          ))}

          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Tagessumme</Text>
            <Text style={styles.totalKcal}>{totals.kcal.toLocaleString('de-DE')} kcal</Text>
            <Text style={styles.totalMeta}>
              {totals.p} g P · {totals.c} g KH · {totals.f} g F
              {targets ? `   (Ziel: ${targets.targetCalories.toLocaleString('de-DE')} kcal)` : ''}
            </Text>
          </View>

          <TouchableOpacity style={[styles.secondaryBtn, generating && { opacity: 0.6 }]} onPress={generate} disabled={generating}>
            {generating ? <ActivityIndicator color="#1F3864" /> : <Text style={styles.secondaryText}>Neu generieren</Text>}
          </TouchableOpacity>
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.disclaimer}>
        Vorschlag auf Basis deiner Angaben – keine medizinische oder ärztliche Ernährungsberatung.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F5FA', paddingTop: 60, paddingHorizontal: 20 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1F3864', marginBottom: 16 },

  targetCard: { backgroundColor: '#1F3864', borderRadius: 16, padding: 18, marginBottom: 16, alignItems: 'center' },
  targetLabel: { color: '#A9B8D6', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  targetKcal: { color: '#fff', fontSize: 30, fontWeight: 'bold', marginTop: 4 },
  targetMacros: { color: '#D6DEEE', fontSize: 14, marginTop: 4 },

  primaryBtn: { backgroundColor: '#1F3864', borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderColor: '#CFD8E3', backgroundColor: '#fff', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  secondaryText: { color: '#2E5496', fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 13, color: '#9AA5B4', marginTop: 14, lineHeight: 18 },

  mealCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  mealType: { fontSize: 12, color: '#8A97A8', fontWeight: '700', letterSpacing: 0.5 },
  mealName: { fontSize: 17, fontWeight: '600', color: '#222', marginTop: 2 },
  mealMeta: { fontSize: 13, color: '#888', marginTop: 4 },

  totalCard: { backgroundColor: '#EAF1FB', borderRadius: 14, padding: 16, marginTop: 4, marginBottom: 12, alignItems: 'center' },
  totalLabel: { fontSize: 12, color: '#2E5496', fontWeight: '700', letterSpacing: 0.5 },
  totalKcal: { fontSize: 22, fontWeight: 'bold', color: '#1F3864', marginTop: 2 },
  totalMeta: { fontSize: 13, color: '#445', marginTop: 4 },

  error: { color: '#B00020', fontSize: 14, marginTop: 14, textAlign: 'center' },
  disclaimer: { fontSize: 12, color: '#9AA5B4', textAlign: 'center', marginTop: 18, lineHeight: 17 },
});
