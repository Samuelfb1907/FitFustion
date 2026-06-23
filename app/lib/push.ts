// Remote-Push-Registrierung (Expo Push Token) - fuer Mitteilungen wie "Anstupsen".
// Funktioniert NUR im echten Build; in Expo Go wirft getExpoPushTokenAsync und wird hier
// still abgefangen (kein Token -> kein Remote-Push, der In-App-Fallback greift weiter).
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

const PROJECT_ID = '75146814-4f6b-45f6-8928-dbb2004f15c8';

export async function registerForPush(): Promise<void> {
  try {
    const perm = await Notifications.getPermissionsAsync();
    let granted = perm.granted || perm.status === 'granted';
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted || req.status === 'granted';
    }
    if (!granted) return;
    const res = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    const token = res?.data;
    if (!token) return;
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return;
    await supabase.from('push_tokens').upsert({
      user_id: uid,
      token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Expo Go / keine Berechtigung / kein Build -> still ignorieren
  }
}
