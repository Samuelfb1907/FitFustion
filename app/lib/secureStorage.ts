// Sicherer Storage-Adapter fuer den Supabase-Auth-Token.
// Statt AsyncStorage (unverschluesselt) wird expo-secure-store genutzt
// (iOS Keychain / Android Keystore-gestuetzt). SecureStore-Werte sind auf ~2048
// Byte begrenzt; Supabase-Sessions sind groesser -> der Wert wird in Chunks
// aufgeteilt. Ein Meta-Eintrag merkt sich die Anzahl der Chunks.
import * as SecureStore from 'expo-secure-store';

const CHUNK = 1800; // sicher unter dem 2048-Byte-Limit (Token ist ASCII/base64)
const META = '__chunks__:';

async function readChunks(key: string): Promise<string | null> {
  const head = await SecureStore.getItemAsync(key);
  if (head == null) return null;
  if (!head.startsWith(META)) return head; // einfacher (kleiner) Wert
  const count = parseInt(head.slice(META.length), 10) || 0;
  let out = '';
  for (let i = 0; i < count; i++) {
    const part = await SecureStore.getItemAsync(`${key}.${i}`);
    if (part == null) return null; // unvollstaendig -> als "nicht vorhanden" behandeln
    out += part;
  }
  return out;
}

async function deleteChunks(key: string): Promise<void> {
  const head = await SecureStore.getItemAsync(key);
  if (head && head.startsWith(META)) {
    const count = parseInt(head.slice(META.length), 10) || 0;
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
  }
}

// Supabase erwartet ein Objekt mit getItem/setItem/removeItem (alle async).
export const SecureStorageAdapter = {
  getItem: (key: string): Promise<string | null> => readChunks(key),
  setItem: async (key: string, value: string): Promise<void> => {
    await deleteChunks(key); // evtl. alte Chunks aufraeumen
    if (value.length <= CHUNK) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const count = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await SecureStore.setItemAsync(key, `${META}${count}`);
  },
  removeItem: async (key: string): Promise<void> => {
    await deleteChunks(key);
    await SecureStore.deleteItemAsync(key);
  },
};
