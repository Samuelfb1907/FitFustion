// Freunde-Aktivitaets-Feed (#48f) - Datenschicht. log_activity schreibt kleine Ereignisse
// ('trained'/'record', Anti-Spam serverseitig), friends_feed liest die der Freunde (Migr. 048).
import { supabase } from './supabase';

export type FeedItem = {
  id: string;
  display_name: string;
  type: 'trained' | 'record';
  detail: string | null;
  created_at: string;
  kudos_count: number;
  i_kudosed: boolean;
};

// Ereignis protokollieren - fire-and-forget (darf nie den Trainingsfluss stoeren).
export async function logActivity(type: 'trained' | 'record', detail?: string): Promise<void> {
  try { await supabase.rpc('log_activity', { p_type: type, p_detail: detail ?? null }); } catch {}
}

export async function fetchFriendsFeed(): Promise<FeedItem[]> {
  const { data, error } = await supabase.rpc('friends_feed');
  if (error) return [];
  return (data ?? []) as FeedItem[];
}

// Kudos umschalten (nur fuer Freunde-Ereignisse; serverseitig geprueft).
// Gibt den neuen Zustand zurueck (true = jetzt gekudost) oder null bei Fehler.
export async function toggleKudos(eventId: string): Promise<boolean | null> {
  const { data, error } = await supabase.rpc('toggle_kudos', { p_event_id: eventId });
  if (error) return null;
  return data as boolean;
}
