// Supabase Edge Function: revenuecat-webhook
// Empfaengt RevenueCat-Webhooks und setzt profiles.is_premium SERVERSEITIG.
// So ist der Premium-Status faelschungssicher (der Client kann is_premium nicht mehr
// selbst aendern -> Migration 034_protect_is_premium.sql).
//
// Deploy OHNE Supabase-JWT-Pruefung (RevenueCat sendet kein Supabase-Token):
//   supabase functions deploy revenuecat-webhook --no-verify-jwt
// Schutz stattdessen ueber ein geheimes Authorization-Header-Token:
//   supabase secrets set REVENUECAT_WEBHOOK_SECRET=<langes-zufaelliges-geheimnis>
// In RevenueCat (Project -> Integrations -> Webhooks):
//   URL              = https://<projekt-ref>.supabase.co/functions/v1/revenuecat-webhook
//   Authorization    = dasselbe Geheimnis wie REVENUECAT_WEBHOOK_SECRET
//
// app_user_id == Supabase-User-ID, weil die App Purchases.logIn(user.id) aufruft.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Ereignisse, die Premium AKTIV bedeuten:
const ACTIVE = new Set([
  'INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE',
  'SUBSCRIPTION_EXTENDED', 'NON_RENEWING_PURCHASE', 'TEMPORARY_ENTITLEMENT_GRANT',
]);
// Ereignisse, die Premium BEENDEN:
const INACTIVE = new Set(['EXPIRATION', 'SUBSCRIPTION_PAUSED']);
// Alles andere (z. B. CANCELLATION = Auto-Verlaengerung aus, laeuft aber bis Ablauf
// weiter; BILLING_ISSUE) aendert den Status NICHT.

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  // 1) Geheimnis pruefen.
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  const auth = req.headers.get('Authorization') ?? '';
  if (!secret || auth !== secret) return new Response('unauthorized', { status: 401 });

  try {
    const body = await req.json().catch(() => ({} as any));
    const event = body?.event ?? {};
    const type: string = event.type ?? '';
    const appUserId: string = event.app_user_id ?? '';
    if (!appUserId) return new Response('no app_user_id', { status: 400 });

    let premium: boolean | null = null;
    if (ACTIVE.has(type)) premium = true;
    else if (INACTIVE.has(type)) premium = false;
    if (premium === null) return new Response('ok (ignored)', { status: 200 });

    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { error } = await admin.from('profiles').update({ is_premium: premium }).eq('id', appUserId);
    if (error) {
      console.error('revenuecat-webhook update failed:', error.message);
      return new Response('db error', { status: 500 });
    }
    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('revenuecat-webhook error:', e);
    return new Response('error', { status: 500 });
  }
});
