// Fortschritts-Fotos (#76e): Upload (verkleinert/komprimiert) in den privaten Bucket
// 'progress-photos', Metadaten in progress_photos. Anzeige ueber signierte URLs.
import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

const BUCKET = 'progress-photos';

export type ProgressPhoto = { id: string; path: string; takenAt: string; weightKg: number | null; url: string };

// base64 -> Bytes (ohne Zusatz-Dependency).
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  const byteLen = Math.floor((clean.length * 3) / 4) - pad;
  const bytes = new Uint8Array(byteLen);
  const idx = (ch: string) => { const v = B64.indexOf(ch); return v < 0 ? 0 : v; };
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (idx(clean[i]) << 18) | (idx(clean[i + 1]) << 12) | (idx(clean[i + 2]) << 6) | idx(clean[i + 3]);
    if (p < byteLen) bytes[p++] = (n >> 16) & 255;
    if (p < byteLen) bytes[p++] = (n >> 8) & 255;
    if (p < byteLen) bytes[p++] = n & 255;
  }
  return bytes;
}

export async function listPhotos(userId: string): Promise<ProgressPhoto[]> {
  const { data, error } = await supabase
    .from('progress_photos').select('id, path, taken_at, weight_kg')
    .eq('user_id', userId).order('taken_at', { ascending: false }).order('created_at', { ascending: false });
  if (error) return [];
  const rows = (data ?? []) as any[];
  const paths = rows.map((r) => r.path);
  const urlMap: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
    (signed ?? []).forEach((s: any) => { if (s.path && s.signedUrl) urlMap[s.path] = s.signedUrl; });
  }
  return rows.map((r) => ({
    id: r.id, path: r.path, takenAt: String(r.taken_at).slice(0, 10),
    weightKg: r.weight_kg != null ? Number(r.weight_kg) : null,
    url: urlMap[r.path] ?? '',
  }));
}

export async function uploadPhoto(userId: string, uri: string, weightKg?: number | null): Promise<boolean> {
  try {
    // Verkleinern (max 1080 px Breite) + JPEG-Komprimierung -> kleine, einheitliche Dateien.
    const manip = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1080 } }], {
      compress: 0.7, format: ImageManipulator.SaveFormat.JPEG,
    });
    const b64 = await FileSystem.readAsStringAsync(manip.uri, { encoding: FileSystem.EncodingType.Base64 });
    const bytes = b64ToBytes(b64);
    const path = `${userId}/${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    if (upErr) return false;
    const { error: insErr } = await supabase.from('progress_photos').insert({ user_id: userId, path, weight_kg: weightKg ?? null });
    if (insErr) { await supabase.storage.from(BUCKET).remove([path]); return false; }
    return true;
  } catch {
    return false;
  }
}

export async function deletePhoto(photo: { id: string; path: string }): Promise<boolean> {
  await supabase.storage.from(BUCKET).remove([photo.path]);
  const { error } = await supabase.from('progress_photos').delete().eq('id', photo.id);
  return !error;
}
