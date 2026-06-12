import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme, Colors } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { isSupabaseConfigured } from './lib/supabase';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import MainTabs from './screens/MainTabs';
import OfflineBanner from './components/OfflineBanner';
import ErrorBoundary from './components/ErrorBoundary';
import { PaywallProvider } from './components/Paywall';
import { loadReminderPrefs, applyReminders } from './lib/reminders';

function Root() {
  const { session, profile, loading, refreshProfile } = useAuth();
  const { colors, theme } = useTheme();

  // Erinnerungen beim Start neu auffuellen (Motivations-Benachrichtigungen werden als
  // einzelne Termine fuer ~45 Tage geplant und muessen regelmaessig nachgefuellt werden).
  useEffect(() => {
    if (!session?.user) return;
    (async () => {
      try {
        const prefs = await loadReminderPrefs();
        if (prefs.enabled) await applyReminders(prefs);
      } catch {}
    })();
  }, [session?.user?.id]);

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
  } else if (profile && !profile.experience_level) {
    content = <OnboardingScreen onDone={refreshProfile} />;
  } else if (!profile) {
    // Eingeloggt, aber Profil konnte nicht geladen werden (z. B. kurzer Verbindungsfehler).
    // NICHT ins Onboarding leiten – das würde bestehende Profildaten überschreiben.
    content = <ProfileLoadError colors={colors} onRetry={refreshProfile} />;
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

function ProfileLoadError({ colors, onRetry }: { colors: Colors; onRetry: () => void }) {
  return (
    <View style={[styles.centered, { backgroundColor: colors.bg }]}>
      <Text style={{ color: colors.heading, fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
        Profil konnte nicht geladen werden
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
        Bitte prüfe deine Internetverbindung und versuche es erneut.
      </Text>
      <TouchableOpacity
        onPress={onRetry}
        style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 28 }}
        accessibilityRole="button"
        accessibilityLabel="Erneut versuchen"
      >
        <Text style={{ color: colors.onPrimary, fontWeight: '800', fontSize: 16 }}>Erneut versuchen</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <ErrorBoundary>
              <PaywallProvider>
                <Root />
              </PaywallProvider>
            </ErrorBoundary>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
