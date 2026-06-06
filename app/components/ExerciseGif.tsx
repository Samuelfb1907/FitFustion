// Animiertes Uebungs-GIF von ExerciseDB (ueber den API-Schluessel geladen).
// Nutzt expo-image mit Disk-Cache (cachePolicy) -> identische GIFs werden nur einmal geladen.
// Bei Fehler (z. B. kein Internet/Key) wird per onFail auf die Muskelgrafik zurueckgefallen.
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '../contexts/ThemeContext';

const HOST = 'exercisedb.p.rapidapi.com';
const KEY = process.env.EXPO_PUBLIC_EXERCISEDB_KEY;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
// Proxy aktiv -> der RapidAPI-Key liegt serverseitig (Edge Function), nicht im App-Bundle.
const USE_PROXY = process.env.EXPO_PUBLIC_EXERCISEDB_PROXY === '1' && !!SUPABASE_URL;

// GIFs verfuegbar, wenn der Proxy aktiv ist ODER ein Client-Key gesetzt ist.
export const GIF_AVAILABLE = USE_PROXY || !!KEY;

// Bildquelle: ueber den Proxy (ohne Key) oder direkt bei RapidAPI (mit Key-Header).
function gifSource(exerciseId: string): { uri: string; headers?: Record<string, string> } {
  if (USE_PROXY) {
    // Anon-Key als JWT mitsenden -> Edge Function laeuft mit Standard-"Verify JWT".
    // Der bezahlte ExerciseDB-Key bleibt serverseitig (Function-Secret).
    return {
      uri: `${SUPABASE_URL}/functions/v1/exercisedb-image?exerciseId=${exerciseId}&resolution=360`,
      headers: ANON ? { Authorization: `Bearer ${ANON}`, apikey: ANON } : undefined,
    };
  }
  return {
    uri: `https://${HOST}/image?exerciseId=${exerciseId}&resolution=360`,
    headers: { 'X-RapidAPI-Key': KEY ?? '', 'X-RapidAPI-Host': HOST },
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

  return (
    <View style={[styles.wrap, { height }]}>
      {!loaded && <ActivityIndicator color={c.primary} style={StyleSheet.absoluteFill} />}
      <Image
        source={gifSource(exerciseId)}
        cachePolicy="memory-disk"
        contentFit="contain"
        style={StyleSheet.absoluteFill}
        onLoad={() => setLoaded(true)}
        onError={() => onFail?.()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // weisser Hintergrund, da die GIFs auf Weiss freigestellt sind
  wrap: { width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFFFF' },
});
