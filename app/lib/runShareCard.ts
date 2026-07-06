// Teilen-Bild fuer einen GPS-Lauf: Karten-Schnappschuss + Werte-Panel als EIN fertiges PNG.
// Das Zusammensetzen (Text ins Bild zeichnen) macht die Edge Function render-run-card,
// weil der aktuelle Build kein natives View-Screenshot-Modul hat - so bleibt alles OTA-faehig.
// Faellt der Server aus, teilt der Aufrufer einfach den rohen Schnappschuss (Fallback dort).
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

export type RunCardStat = { label: string; value: string };
export type RunCardDot = { fx: number; fy: number; kind: 'start' | 'end' }; // relativ (0..1) im Ausschnitt

// Liefert die Datei-URI des fertigen Bilds oder null (dann Fallback beim Aufrufer).
export async function buildRunCardFile(params: {
  mapBase64: string;        // Karten-Schnappschuss (PNG-Base64, ohne data:-Prefix)
  title: string;            // z. B. "Laufen"
  date: string;             // z. B. "7. Juli 2026"
  stats: RunCardStat[];     // Distanz/Zeit/Ø-Tempo (fertig formatiert)
  kcalText: string;         // z. B. "461 kcal"
  dots?: RunCardDot[];      // Start-/Ziel-Punkt (malt der Server ins Bild)
}): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('render-run-card', {
      body: { map: params.mapBase64, title: params.title, date: params.date, stats: params.stats, kcalText: params.kcalText, dots: params.dots ?? [] },
    });
    const b64 = (data as any)?.image;
    if (error || typeof b64 !== 'string' || b64.length < 100) return null;
    const uri = `${FileSystem.cacheDirectory}fitavo-lauf-${Date.now()}.png`;
    await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
    return uri;
  } catch {
    return null;
  }
}

// Roh-Schnappschuss (Base64) als Datei ablegen - Fallback, wenn der Server nicht antwortet.
export async function writeSnapshotFile(mapBase64: string): Promise<string | null> {
  try {
    const uri = `${FileSystem.cacheDirectory}fitavo-lauf-karte-${Date.now()}.png`;
    await FileSystem.writeAsStringAsync(uri, mapBase64, { encoding: FileSystem.EncodingType.Base64 });
    return uri;
  } catch {
    return null;
  }
}

// Datum fuer die Karte: "7. Juli 2026" / "July 7, 2026".
export function runCardDate(ms: number, lang: string): string {
  try {
    return new Date(ms).toLocaleDateString(lang === 'en' ? 'en-US' : 'de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return new Date(ms).toLocaleDateString();
  }
}
