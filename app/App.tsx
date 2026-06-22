import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Alert, AppState, AppStateStatus, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme, Colors } from './contexts/ThemeContext';
import { LanguageProvider, useT } from './contexts/LanguageContext';
import { isSupabaseConfigured } from './lib/supabase';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import MainTabs from './screens/MainTabs';
import OfflineBanner from './components/OfflineBanner';
import ErrorBoundary from './components/ErrorBoundary';
import { PaywallProvider } from './components/Paywall';
import { loadReminderPrefs, applyReminders, scheduleWinback, cancelWinback } from './lib/reminders';
import { addFriend, friendCodeFromUrl } from './lib/friends';
import { lobbyCodeFromUrl, joinLobby, syncTodaySteps } from './lib/lobby';
import AsyncStorage from '@react-native-async-storage/async-storage';

function Root() {
  const { session, profile, loading, refreshProfile } = useAuth();
  const { colors, theme } = useTheme();
  const t = useT();

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

  // Win-back: beim Hintergrund-Wechsel Tag-3/7-Inaktivitaets-Pushes planen,
  // beim Zurueckkehren (Vordergrund/Start) wieder canceln.
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    if (!session?.user) return;
    // Beim Mount im Vordergrund evtl. offene Win-back-Termine entfernen.
    cancelWinback().catch(() => {});
    const onChange = (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      (async () => {
        try {
          if (next === 'active') {
            await cancelWinback();
          } else if (next === 'background') {
            const prefs = await loadReminderPrefs();
            if (prefs.enabled) await scheduleWinback();
          }
        } catch {}
      })();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [session?.user?.id]);

  // Einladungslink: oeffnet jemand fitavo://freund?u=<id> (bzw. den Web-Link, der dorthin
  // weiterleitet), wird er als Freund hinzugefuegt (beidseitig). Kaltstart + Betrieb.
  useEffect(() => {
    if (!session?.user) return;
    const seen = new Set<string>();
    async function handle(url: string | null) {
      if (!url) return;
      const code = friendCodeFromUrl(url);
      if (code && !seen.has(code)) {
        seen.add(code);
        const err = await addFriend(code);
        if (!err) Alert.alert(t('leaderboard.friends.addedTitle'), t('leaderboard.friends.addedBody'));
      }
      // Lobby-Einladungslink (fitavo://lobby?code= bzw. Web-Link): per Code beitreten.
      const lCode = lobbyCodeFromUrl(url);
      if (lCode && !seen.has(lCode)) {
        seen.add(lCode);
        let name = 'Ich';
        try { const n = await AsyncStorage.getItem('fitavo.lobbyName'); if (n) name = n; } catch {}
        const id = await joinLobby(lCode, name);
        if (id) Alert.alert(t('lobby.joined'), t('lobby.deeplinkBody'));
      }
    }
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, [session?.user?.id]);

  // Schritte fuer die Lobby aktuell halten: beim Start + bei jeder Rueckkehr in den Vordergrund
  // die heutigen Schritte hochladen (in Expo Go Beispielwerte, im echten Build echte Schritte).
  useEffect(() => {
    if (!session?.user) return;
    syncTodaySteps().catch(() => {});
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') syncTodaySteps().catch(() => {}); });
    return () => sub.remove();
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
