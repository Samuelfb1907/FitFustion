// Freunde-Aktivitaets-Feed (#48f) - Datenschicht. log_activity schreibt kleine Ereignisse
// ('trained'/'record', Anti-Spam serverseitig), friends_feed liest die der Freunde (Migr. 048).
import { supabase } from './supabase';

export type FeedItem = { display_name: string; type: 'trained' | 'record'; detail: string | null; created_at: string };

// Ereignis protokollieren - fire-and-forget (darf nie den Trainingsfluss stoeren).
export async function logActivity(type: 'trained' | 'record', detail?: string): Promise<void> {
  try { await supabase.rpc('log_activity', { p_type: type, p_detail: detail ?? null }); } catch {}
}

export async function fetchFriendsFeed(): Promise<FeedItem[]> {
  const { data, error } = await supabase.rpc('friends_feed');
  if (error) return [];
  return (data ?? []) as FeedItem[];
}
