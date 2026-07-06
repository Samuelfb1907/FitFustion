// Freund-Profil (Phase 1c-lite) - Datenschicht. Holt die fuer Freunde sichtbaren, sicheren
// Kennzahlen eines Nutzers per friend_profile-RPC (Migration 065, Freundschafts-geprueft).
// Bewusst KEINE sensiblen Daten (Gewicht/Kalorien/Essen/Koerpermasse).
import { supabase } from './supabase';

export type FriendRecord = { ex: string | null; created_at: string };

export type FriendProfile = {
  display_name: string;
  is_me: boolean;
  member_since: string;
  streak: number;
  best_streak: number;
  workouts: number;
  sets: number;
  tonnage_kg: number;
  cardio_count: number;
  cardio_kcal: number;
  active_days: number;
  records: FriendRecord[];
};

// Profil per kurzem Freund-Code laden. null = nicht befreundet / nicht gefunden / Fehler.
export async function fetchFriendProfile(friendCode: string): Promise<FriendProfile | null> {
  const { data, error } = await supabase.rpc('friend_profile', { p_code: friendCode });
  if (error || !data) return null;
  return data as FriendProfile;
}
