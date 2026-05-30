import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { isSupabaseConfigured } from './lib/supabase';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';

// Entscheidet anhand von Login- und Profil-Status, welcher Screen erscheint.
function Root() {
  const { session, profile, loading, refreshProfile } = useAuth();

  // Sicherheitsnetz: Zugangsdaten fehlen
  if (!isSupabaseConfigured) {
    return (
      <View style={styles.centered}>
        <Text style={styles.warn}>
          Bitte Supabase-Zugangsdaten in app/.env eintragen und den Server neu starten.
        </Text>
      </View>
    );
  }

  // Status wird geladen
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1F3864" />
      </View>
    );
  }

  // Nicht eingeloggt -> Login/Registrierung
  if (!session) return <AuthScreen />;

  // Eingeloggt, aber Onboarding noch nicht erledigt -> Onboarding
  const onboardingDone = !!profile?.experience_level;
  if (!onboardingDone) return <OnboardingScreen onDone={refreshProfile} />;

  // Eingeloggt + Onboarding fertig -> Home
  return <HomeScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  warn: { fontSize: 15, color: '#B00020', textAlign: 'center' },
});
