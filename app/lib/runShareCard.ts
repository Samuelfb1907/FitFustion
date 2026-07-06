// Teilen-Bild fuer einen GPS-Lauf: Karten-Schnappschuss + Werte-Panel als EIN fertiges PNG.
// Das Zusammensetzen (Text ins Bild zeichnen) macht die Edge Function render-run-card,
// weil der aktuelle Build kein natives View-Screenshot-Modul hat - so bleibt alles OTA-faehig.
// Faellt der Server aus, teilt der Aufrufer einfach den rohen Schnappschuss (Fallback dort).
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { supabase } from './supabase';

export type RunCardStat = { label: string; value: string };
export type RunCardRegion = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

// FitAvo-Maskottchen (transparentes PNG) als Base64 - kommt mit ins Teilen-Bild.
// Einmal pro App-Lauf laden und merken; bei Fehlern einfach ohne Logo weitermachen.
let avoB64: string | null | undefined;
async function loadLogoB64(): Promise<string | null> {
  if (avoB64 !== undefined) return avoB64;
  try {
    const a = Asset.fromModule(require('../assets/share-avocado.png'));
    if (!a.localUri) await a.downloadAsync();
    avoB64 = a.localUri ? await FileSystem.readAsStringAsync(a.localUri, { encoding: FileSystem.EncodingType.Base64 }) : null;
  } catch {
    avoB64 = null;
  }
  return avoB64;
}

// Liefert die Datei-URI des fertigen Bilds oder null (dann Fallback beim Aufrufer).
// Der Server baut die Karte selbst (saubere Kacheln ohne Laeden-Namen) und zeichnet
// die Route als glatte Linie - deshalb reichen Region + Streckenpunkte.
export async function buildRunCardFile(params: {
  region: RunCardRegion;    // Karten-Ausschnitt (6:5, aus shareRegion)
  route: { lat: number; lng: number }[]; // vereinfachte Strecke (simplifyRoute)
  title: string;            // z. B. "Laufen"
  date: string;             // z. B. "7. Juli 2026"
  stats: RunCardStat[];     // Distanz/Zeit/Ø-Geschwindigkeit (fertig formatiert)
  kcalText: string;         // z. B. "461 kcal"
}): Promise<string | null> {
  try {
    const logo = await loadLogoB64();
    // Koordinaten auf ~1 m runden - mehr Genauigkeit braucht das Bild nicht.
    const route = params.route.slice(0, 800).map((p) => ({ lat: Number(p.lat.toFixed(5)), lng: Number(p.lng.toFixed(5)) }));
    const { data, error } = await supabase.functions.invoke('render-run-card', {
      body: { region: params.region, route, title: params.title, date: params.date, stats: params.stats, kcalText: params.kcalText, logo: logo ?? '' },
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
