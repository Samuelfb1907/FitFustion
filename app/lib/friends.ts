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
