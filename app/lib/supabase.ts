// Supabase-Client für die FitAvo-App (React Native / Expo)
// -----------------------------------------------------------------
// Diese Datei stellt EINE zentrale Verbindung zur Datenbank bereit.
// Überall in der App importierst du einfach: import { supabase } from '../lib/supabase'
//
// Die Zugangsdaten kommen aus app/.env (Werte mit Prefix EXPO_PUBLIC_).
// WICHTIG: Nach Änderungen an .env den Expo-Server NEU starten.

import 'react-native-url-polyfill/auto'; // Polyfill, das Supabase unter React Native benötigt
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Kleine Hilfe für die UI: Sind die Zugangsdaten schon eingetragen?
// Ein echter Supabase-Key beginnt mit "eyJ" (JWT) oder "sb_" (neues Format).
export const isSupabaseConfigured =
  supabaseUrl.startsWith('https://') &&
  supabaseUrl.includes('.supabase.co') &&
  (supabaseAnonKey.startsWith('eyJ') || supabaseAnonKey.startsWith('sb_'));

export const supabase = createClient(
  // Platzhalter verhindern einen Absturz, falls .env noch leer ist.
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,     // Login bleibt auf dem Gerät gespeichert
      autoRefreshToken: true,    // Token wird automatisch erneuert
      persistSession: true,
      detectSessionInUrl: false, // wichtig für mobile Apps (kein Browser-Redirect)
    },
  }
);
