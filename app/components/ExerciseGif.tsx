// Animiertes Uebungs-GIF von ExerciseDB (ueber den API-Schluessel geladen).
// Nutzt expo-image mit Disk-Cache (cachePolicy) -> identische GIFs werden nur einmal geladen.
// Bei Fehler (z. B. kein Internet/Key) wird per onFail auf die Muskelgrafik zurueckgefallen.
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '../contexts/ThemeContext';

const HOST = 'exercisedb.p.rapidapi.com';
const KEY = process.env.EXPO_PUBLIC_EXERCISEDB_KEY;

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
  const uri = `https://${HOST}/image?exerciseId=${exerciseId}&resolution=360`;

  return (
    <View style={[styles.wrap, { height }]}>
      {!loaded && <ActivityIndicator color={c.primary} style={StyleSheet.absoluteFill} />}
      <Image
        source={{ uri, headers: { 'X-RapidAPI-Key': KEY ?? '', 'X-RapidAPI-Host': HOST } }}
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
