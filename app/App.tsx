import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { isSupabaseConfigured } from './lib/supabase';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import MainTabs from './screens/MainTabs';
import OfflineBanner from './components/OfflineBanner';
import ErrorBoundary from './components/ErrorBoundary';

function Root() {
  const { session, profile, loading, refreshProfile } = useAuth();
  const { colors, theme } = useTheme();

  let content;
  if (!isSupabaseConfigured) {
    content = (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.danger, textAlign: 'center', fontSize: 15 }}>
          Bitte Supabase-Zugangsdaten in app/.env eintragen und den Server neu starten.
        </Text>
      </View>
    );
  } else if (loading) {
    content = (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  } else if (!session) {
    content = <AuthScreen />;
  } else if (!profile?.experience_level) {
    content = <OnboardingScreen onDone={refreshProfile} />;
  } else {
    content = <MainTabs />;
  }

  return (
    <>
      {content}
      <OfflineBanner />
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary>
            <Root />
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
