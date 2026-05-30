// Start-Screen fuer eingeloggte Nutzer: zeigt den taeglichen Kalorien- & Makrobedarf.
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  computeNutrition,
  ageFromBirthDate,
  NutritionResult,
  Gender,
  ActivityLevel,
  GoalType,
} from '../lib/nutrition';

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'Abnehmen',
  build_muscle: 'Muskelaufbau',
  gain_strength: 'Kraft steigern',
  endurance: 'Ausdauer',
  general_fitness: 'Allgemeine Fitness',
  get_defined: 'Definieren',
};

function Macro({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.macro}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <Text style={styles.macroValue}>{value} g</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const { session, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nutrition, setNutrition] = useState<NutritionResult | null>(null);
  const [goalLabel, setGoalLabel] = useState('');

  useEffect(() => {
    async function load() {
      const userId = session?.user?.id;
      if (!userId) return;

      // Vollständiges Profil (für die Berechnung)
      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select('weight_kg, height_cm, birth_date, gender, activity_level')
        .eq('id', userId)
        .maybeSingle();

      // Aktives Ziel (neuestes)
      const { data: goal } = await supabase
        .from('goals')
        .select('goal_type')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pErr || !prof || !prof.weight_kg || !prof.height_cm) {
        setError('Deine Profildaten sind unvollständig. Bitte das Onboarding erneut durchlaufen.');
        setLoading(false);
        return;
      }

      const goalType = (goal?.goal_type ?? 'general_fitness') as GoalType;
      const result = computeNutrition({
        weightKg: Number(prof.weight_kg),
        heightCm: Number(prof.height_cm),
        age: ageFromBirthDate(prof.birth_date),
        gender: (prof.gender ?? 'prefer_not') as Gender,
        activity: (prof.activity_level ?? 'moderate') as ActivityLevel,
        goal: goalType,
      });
      setNutrition(result);
      setGoalLabel(GOAL_LABELS[goalType] ?? goalType);
      setLoading(false);
    }
    load();
  }, [session?.user?.id]);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Hallo, {profile?.first_name || 'willkommen'}! 👋</Text>
          <Text style={styles.email}>{session?.user.email}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {loading && <ActivityIndicator size="large" color="#1F3864" style={{ marginTop: 40 }} />}

        {!loading && error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && !error && nutrition && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>DEIN TAGESZIEL · {goalLabel}</Text>
              <Text style={styles.kcal}>{nutrition.targetCalories.toLocaleString('de-DE')}</Text>
              <Text style={styles.kcalUnit}>kcal pro Tag</Text>

              <View style={styles.macros}>
                <Macro label="Protein" value={nutrition.proteinG} color="#2E7D32" />
                <Macro label="Kohlenhydrate" value={nutrition.carbsG} color="#E69500" />
                <Macro label="Fett" value={nutrition.fatG} color="#C62828" />
              </View>

              <View style={styles.divider} />
              <View style={styles.subRow}>
                <Text style={styles.subItem}>Grundumsatz{'\n'}<Text style={styles.subValue}>{nutrition.bmr} kcal</Text></Text>
                <Text style={styles.subItem}>Erhaltung{'\n'}<Text style={styles.subValue}>{nutrition.tdee} kcal</Text></Text>
              </View>
            </View>

            <Text style={styles.disclaimer}>
              Richtwert auf Basis deiner Angaben (Mifflin-St-Jeor-Formel). Keine medizinische Beratung.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F5FA', paddingTop: 60, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  hello: { fontSize: 24, fontWeight: 'bold', color: '#1F3864' },
  email: { fontSize: 13, color: '#777', marginTop: 2 },
  logoutBtn: { borderWidth: 1, borderColor: '#CFD8E3', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' },
  logoutText: { color: '#2E5496', fontWeight: '600' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardLabel: { fontSize: 12, letterSpacing: 1, color: '#8A97A8', fontWeight: '700' },
  kcal: { fontSize: 56, fontWeight: 'bold', color: '#1F3864', marginTop: 6 },
  kcalUnit: { fontSize: 15, color: '#666', marginTop: -4 },

  macros: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 24 },
  macro: { flex: 1, alignItems: 'center' },
  macroDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
  macroValue: { fontSize: 18, fontWeight: '700', color: '#222' },
  macroLabel: { fontSize: 12, color: '#777', marginTop: 2, textAlign: 'center' },

  divider: { height: 1, backgroundColor: '#EEF1F6', width: '100%', marginTop: 22, marginBottom: 14 },
  subRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  subItem: { fontSize: 12, color: '#8A97A8', textAlign: 'center' },
  subValue: { fontSize: 15, color: '#444', fontWeight: '700' },

  disclaimer: { fontSize: 12, color: '#9AA5B4', textAlign: 'center', marginTop: 16, lineHeight: 17 },
  errorBox: { backgroundColor: '#FFF4F4', borderColor: '#E0A0A0', borderWidth: 1, borderRadius: 10, padding: 16, marginTop: 24 },
  errorText: { fontSize: 14, color: '#7a2a2a' },
});
