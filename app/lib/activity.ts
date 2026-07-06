// Freunde-Aktivitaets-Feed (#48f) - Datenschicht. log_activity schreibt kleine Ereignisse
// ('trained'/'record', Anti-Spam serverseitig), friends_feed liest die der Freunde (Migr. 048).
import { supabase } from './supabase';

export type FeedItem = {
  id: string;
  display_name: string;
  type: 'trained' | 'record' | 'cardio';
  detail: string | null;
  created_at: string;
  kudos_count: number;
  i_kudosed: boolean;
  comment_count: number;
};

export type CommentItem = { id: string; user_id: string; display_name: string; body: string; created_at: string };

// Ereignis protokollieren - fire-and-forget (darf nie den Trainingsfluss stoeren).
export async function logActivity(type: 'trained' | 'record' | 'cardio', detail?: string): Promise<void> {
  try { await supabase.rpc('log_activity', { p_type: type, p_detail: detail ?? null }); } catch {}
}

export async function fetchFriendsFeed(): Promise<FeedItem[]> {
  const { data, error } = await supabase.rpc('friends_feed');
  if (error) return [];
  return (data ?? []) as FeedItem[];
}

// Kudos umschalten (nur fuer Freunde-Ereignisse; serverseitig geprueft).
// Gibt den neuen Zustand zurueck (true = jetzt gekudost) oder null bei Fehler.
// Der Push an den Ersteller wird jetzt SERVERSEITIG per DB-Trigger ausgeloest (Migration 067),
// nicht mehr vom Client - so kommt er unabhaengig von der App-Version des Reagierenden an.
export async function toggleKudos(eventId: string): Promise<boolean | null> {
  const { data, error } = await supabase.rpc('toggle_kudos', { p_event_id: eventId });
  if (error) return null;
  return data as boolean;
}

// Kommentare eines Ereignisses laden (aelteste zuerst).
export async function fetchComments(eventId: string): Promise<CommentItem[]> {
  const { data, error } = await supabase.rpc('event_comments', { p_event_id: eventId });
  if (error) return [];
  return (data ?? []) as CommentItem[];
}

// Kommentar hinzufuegen -> gibt den neuen Kommentar zurueck (oder null bei Fehler/leer).
export async function addComment(eventId: string, body: string): Promise<CommentItem | null> {
  const { data, error } = await supabase.rpc('add_comment', { p_event_id: eventId, p_body: body });
  if (error) return null;
  const rows = (data ?? []) as CommentItem[];
  return rows[0] ?? null; // Push loest jetzt der DB-Trigger aus (Migration 067)
}

// Eigenen Kommentar loeschen.
export async function deleteComment(commentId: string): Promise<void> {
  try { await supabase.rpc('delete_comment', { p_comment_id: commentId }); } catch {}
}

// --- "Aktivitaet bei dir": wer auf MEINE Ereignisse reagiert hat (Migration 066) ---
export type SocialNotification = {
  kind: 'kudos' | 'comment';
  actor_name: string;
  event_id: string;
  event_type: 'trained' | 'record' | 'cardio';
  event_detail: string | null;
  body: string | null;       // Kommentartext (nur bei kind='comment')
  created_at: string;
  is_new: boolean;           // seit letztem Ansehen
};

export async function fetchMySocialNotifications(): Promise<SocialNotification[]> {
  const { data, error } = await supabase.rpc('my_social_notifications');
  if (error) return [];
  return (data ?? []) as SocialNotification[];
}

// Alles als gesehen markieren (setzt profiles.social_seen_at = now()).
export async function markSocialSeen(): Promise<void> {
  try { await supabase.rpc('mark_social_seen'); } catch {}
}

// Anzahl NEUER (ungesehener) Reaktionen auf meine Aktivitaeten - fuer den Punkt am Lobby-Tab.
export async function fetchUnreadSocialCount(): Promise<number> {
  const list = await fetchMySocialNotifications();
  return list.reduce((n, x) => n + (x.is_new ? 1 : 0), 0);
}
