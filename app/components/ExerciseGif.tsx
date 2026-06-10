// Animiertes Uebungs-GIF von ExerciseDB (ueber den serverseitigen Proxy geladen).
// Nutzt expo-image mit Disk-Cache (cachePolicy) -> identische GIFs werden nur einmal geladen.
// Bei Fehler (z. B. kein Internet/Key) wird per onFail auf die Muskelgrafik zurueckgefallen.
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { supabase } from '../lib/supabase';
import { Colors } from '../contexts/ThemeContext';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
// GIFs laufen AUSSCHLIESSLICH ueber den serverseitigen Proxy (Edge Function).
// So bleibt der bezahlte ExerciseDB/RapidAPI-Key immer serverseitig und landet
// nie im App-Bundle. Ohne Proxy: keine GIFs -> es wird auf die Muskelgrafik
// zurueckgefallen (siehe GIF_AVAILABLE / onFail).
const USE_PROXY = process.env.EXPO_PUBLIC_EXERCISEDB_PROXY === '1' && !!SUPABASE_URL;

export const GIF_AVAILABLE = USE_PROXY;

// Der Proxy prueft das JWT (verify_jwt). Der Publishable-/Anon-Key ist KEIN gueltiges
// JWT -> als Bearer schicken wir den Access-Token der aktuellen Anmeldung. Der Anon-Key
// dient nur noch als apikey-Header (von der Supabase-Gateway erwartet).
function gifSource(exerciseId: string, token: string | null): { uri: string; headers?: Record<string, string> } {
  const bearer = token ?? ANON;
  const headers: Record<string, string> = {};
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (ANON) headers.apikey = ANON;
  return {
    uri: `${SUPABASE_URL}/functions/v1/exercisedb-image?exerciseId=${exerciseId}&resolution=360`,
    headers: Object.keys(headers).length ? headers : undefined,
  };
}

export default function ExerciseGif({
  exerciseId,
  c,
  height = 240,
  onFail,
}: {
  exerciseId: string;
  c: Colors;
  height?: number;
  onFail?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  // undefined = Token wird noch geladen (noch kein Bild-Request, sonst 401 vor Login-Token)
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setToken(data.session?.access_token ?? null);
    });
    return () => { active = false; };
  }, []);

  return (
    <View style={[styles.wrap, { height }]}>
      {(!loaded || token === undefined) && <ActivityIndicator color={c.primary} style={StyleSheet.absoluteFill} />}
      {token !== undefined && (
        <Image
          source={gifSource(exerciseId, token)}
          cachePolicy="memory-disk"
          contentFit="contain"
          style={StyleSheet.absoluteFill}
          onLoad={() => setLoaded(true)}
          onError={() => onFail?.()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // weisser Hintergrund, da die GIFs auf Weiss freigestellt sind
  wrap: { width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFFFF' },
});
