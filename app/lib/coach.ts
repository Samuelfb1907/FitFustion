// "Frag den Coach" (#1) - Client-Datenschicht. Ruft die Edge Function coach-chat (Claude).
// Premium + KI-Tageslimit werden serverseitig geprueft; hier nur Aufruf + Fehler-Mapping.
import { supabase } from './supabase';

export type CoachMessage = { role: 'user' | 'assistant'; content: string };
export type CoachError = 'premium_required' | 'rate_limited' | 'consent_required' | 'error';
export type CoachResult = { reply: string } | { error: CoachError };

export async function askCoach(messages: CoachMessage[], lang: string, context?: string): Promise<CoachResult> {
  try {
    const ctx = context && context.trim() ? context.trim().slice(0, 300) : undefined;
    const { data, error } = await supabase.functions.invoke('coach-chat', {
      body: { messages, lang: lang === 'en' ? 'en' : 'de', context: ctx },
    });
    if (error || !data) return { error: 'error' };
    const d = data as any;
    if (d.error) {
      const known: CoachError[] = ['premium_required', 'rate_limited', 'consent_required'];
      return { error: known.includes(d.error) ? d.error : 'error' };
    }
    return { reply: typeof d.reply === 'string' ? d.reply : '' };
  } catch {
    return { error: 'error' };
  }
}
