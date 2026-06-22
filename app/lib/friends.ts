// Freunde (#48) - Datenschicht. Tabelle friendships + RPCs add_friend/remove_friend/
// friends_leaderboard (Migration 041), per RLS / SECURITY DEFINER abgesichert.
// Einladungs-Code = eigene User-ID; wird als Link geteilt. Reine Datenzugriffe;
// Deep-Link-Handling + UI nutzen diese Funktionen.
import { supabase } from './supabase';

export type FriendRow = {
  display_name: string;
  weekly_days: number;
  monthly_days: number;
  streak: number;
  week_key: string | null;
  month_key: string | null;
  is_me: boolean;
};

// Einladungslink (Web-Fallback oeffnet die App via fitavo://; Schema in app.json gesetzt).
export function inviteLink(userId: string): string {
  return `https://www.fitavo.eu/freund?u=${userId}`;
}

// Freund-Code aus einem geoeffneten Link extrahieren (Web- ODER fitavo://-Form).
export function friendCodeFromUrl(url: string): string | null {
  const m = url.match(/[?&]u=([0-9a-fA-F-]{36})/);
  return m ? m[1] : null;
}

export async function addFriend(friendId: string): Promise<string | null> {
  const { error } = await supabase.rpc('add_friend', { p_friend: friendId });
  return error ? error.message : null;
}

export async function removeFriend(friendId: string): Promise<void> {
  await supabase.rpc('remove_friend', { p_friend: friendId });
}

export async function fetchFriendsBoard(): Promise<FriendRow[]> {
  const { data, error } = await supabase.rpc('friends_leaderboard');
  if (error) throw error;
  return (data ?? []) as FriendRow[];
}

// --- Freund-Codes (#48c): kurzer persoenlicher Code statt Link (Migration 043) ---
export type Friend = { friend_code: string; display_name: string };

// Eigener Freund-Code zum Teilen. Liest die eigene profiles-Zeile (per RLS erlaubt).
export async function getMyFriendCode(): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return null;
  const { data } = await supabase.from('profiles').select('friend_code').eq('id', uid).maybeSingle();
  return (data as any)?.friend_code ?? null;
}

// Freund per Code hinzufuegen. Gibt den Vornamen zurueck, oder null (Code unbekannt/eigener).
export async function addFriendByCode(code: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('add_friend_by_code', { p_code: code });
  if (error) throw error;
  return (data ?? null) as string | null;
}

export async function fetchFriends(): Promise<Friend[]> {
  const { data, error } = await supabase.rpc('friends_list');
  if (error) throw error;
  return (data ?? []) as Friend[];
}

export async function removeFriendByCode(code: string): Promise<void> {
  await supabase.rpc('remove_friend_by_code', { p_code: code });
}

// --- Anstupsen (#48d, Migration 045) ---
export type Nudge = { from_name: string; created_at: string };

// Freund (per Code) anstupsen. true = angestupst (oder schon offen), false = ging nicht.
export async function sendNudge(code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('send_nudge', { p_code: code });
  if (error) return false;
  return !!data;
}

// Offene Stupser abrufen + serverseitig als gesehen markieren.
export async function fetchPendingNudges(): Promise<Nudge[]> {
  const { data, error } = await supabase.rpc('pending_nudges');
  if (error) return [];
  return (data ?? []) as Nudge[];
}
