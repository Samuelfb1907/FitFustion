// Schritte-Lobbys (#48b) - Datenschicht. Tabellen lobbies/lobby_members/daily_steps +
// RPCs create_lobby/join_lobby/upsert_today_steps/lobby_board (Migration 042), per RLS /
// SECURITY DEFINER abgesichert. Eine Lobby = Gruppe mit kurzem Einladungs-Code; Mitglieder
// duellieren sich taeglich in Schritten (meiste oben).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { healthSupported, getTodaySteps } from './health';

export type Lobby = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
};

export type LobbyRow = {
  display_name: string;
  steps_today: number;
  is_me: boolean;
};

// Einladungslink zur Lobby (Web-Fallback leitet via fitavo://lobby?code= in die App).
export function lobbyInviteLink(code: string): string {
  return `https://www.fitavo.eu/lobby?code=${encodeURIComponent(code)}`;
}

// Lobby-Code aus einem geoeffneten Link extrahieren (Web- ODER fitavo://-Form).
export function lobbyCodeFromUrl(url: string): string | null {
  const m = url.match(/[?&]code=([A-Za-z0-9]{4,12})/);
  return m ? m[1].toUpperCase() : null;
}

export async function createLobby(name: string, displayName: string): Promise<Lobby | null> {
  const { data, error } = await supabase.rpc('create_lobby', { p_name: name, p_display_name: displayName });
  if (error) throw error;
  return (data ?? null) as Lobby | null;
}

// Per Code beitreten. Gibt die lobby_id zurueck, oder null bei unbekanntem Code.
export async function joinLobby(code: string, displayName: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('join_lobby', { p_code: code, p_display_name: displayName });
  if (error) throw error;
  return (data ?? null) as string | null;
}

export async function leaveLobby(lobbyId: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return;
  await supabase.from('lobby_members').delete().eq('lobby_id', lobbyId).eq('user_id', uid);
}

export async function fetchMyLobbies(): Promise<Lobby[]> {
  const { data, error } = await supabase.from('lobbies').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Lobby[];
}

export async function fetchLobbyBoard(lobbyId: string): Promise<LobbyRow[]> {
  const { data, error } = await supabase.rpc('lobby_board', { p_lobby: lobbyId });
  if (error) throw error;
  return (data ?? []) as LobbyRow[];
}

// Wochen-Wertung (#44): Schritte-Summe der laufenden Woche je Mitglied.
export type LobbyWeekRow = { display_name: string; steps: number; is_me: boolean };
export type HallEntry = { week_key: string; display_name: string; steps: number };

export async function fetchLobbyWeekBoard(lobbyId: string): Promise<LobbyWeekRow[]> {
  const { data, error } = await supabase.rpc('lobby_week_board', { p_lobby: lobbyId });
  if (error) throw error;
  return (data ?? []) as LobbyWeekRow[];
}

// Ruhmeshalle: finalisiert serverseitig die letzte Woche (lazy) + liefert die Sieger.
export async function fetchLobbyHallOfFame(lobbyId: string): Promise<HallEntry[]> {
  const { data, error } = await supabase.rpc('lobby_hall_of_fame', { p_lobby: lobbyId });
  if (error) throw error;
  return (data ?? []) as HallEntry[];
}

// Heutige Schritte ermitteln + hochladen. Echter Build: echte Sensor-Schritte.
// Expo Go (kein Sensor): stabiler Beispielwert, damit die Rangliste beim Testen lebt.
export async function syncTodaySteps(): Promise<number> {
  const steps = healthSupported() ? await getTodaySteps() : await sampleSteps();
  try { await supabase.rpc('upsert_today_steps', { p_steps: steps }); } catch {}
  return steps;
}

// Beispiel-Schritte fuer Expo Go: pro Tag fest (einmal gewuerfelt, dann stabil aus dem Cache).
async function sampleSteps(): Promise<number> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `fitavo.sampleSteps.${day}`;
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) return parseInt(cached, 10) || 0;
    const base = 3000 + Math.floor(Math.random() * 9000);
    await AsyncStorage.setItem(key, String(base));
    return base;
  } catch {
    return 6000;
  }
}
