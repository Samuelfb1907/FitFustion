import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { isSupabaseConfigured } from './lib/supabase';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import MainTabs from './screens/MainTabs';

// Entscheidet anhand von Login- und Profil-Status, welcher Screen erscheint.
function Root() {
  const { session, profile, loading, refreshProfile } = useAuth();

  if (!isSupabaseConfigured) {
    return (
      <View style={styles.centered}>
        <Text style={styles.warn}>
          Bitte Supabase-Zugangsdaten in app/.env eintragen und den Server neu starten.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1F3864" />
      </View>
    );
  }

  if (!session) return <AuthScreen />;

  const onboardingDone = !!profile?.experience_level;
  if (!onboardingDone) return <OnboardingScreen onDone={refreshProfile} />;

  // Eingeloggt + Onboarding fertig -> App mit Tab-Navigation
  return <MainTabs />;
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
