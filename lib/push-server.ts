import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export interface PushPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
  renotify?: boolean;
}

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function isPushConfigured() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY
      && process.env.VAPID_PRIVATE_KEY
      && process.env.VAPID_SUBJECT,
  );
}

function configureWebPush() {
  if (!isPushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  return true;
}

export async function savePushSubscription(input: {
  shopId: number;
  userId?: number | null;
  subscription: Record<string, unknown>;
}) {
  const supabase = getServerSupabase();
  if (!supabase) throw new Error('Supabase server configuration is missing.');

  const endpoint = typeof input.subscription.endpoint === 'string' ? input.subscription.endpoint : '';
  if (!endpoint) throw new Error('Invalid push subscription.');

  const { error } = await supabase.from('push_subscriptions').upsert({
    shop_id: input.shopId,
    user_id: input.userId || null,
    endpoint,
    subscription: input.subscription,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });
  if (error) throw error;
}

export async function claimPushDelivery(shopId: number, dedupeKey: string, kind: string) {
  const supabase = getServerSupabase();
  if (!supabase) throw new Error('Supabase server configuration is missing.');

  const { error } = await supabase.from('push_notification_deliveries').insert({
    shop_id: shopId,
    dedupe_key: dedupeKey,
    kind,
  });
  if (!error) return true;
  if ((error as { code?: string }).code === '23505') return false;
  // Delivery logging is optional. A project that has not yet received the
  // push-notification migration must still be able to create the alert and
  // send the push notification; it simply cannot deduplicate this request.
  if ((error as { code?: string }).code === 'PGRST205') {
    console.warn(
      '[Push] Delivery deduplication is unavailable. Apply supabase/migrations/20260715_add_push_notifications.sql.',
    );
    return true;
  }
  throw error;
}

export async function sendPushToShop(shopId: number, payload: PushPayload) {
  const supabase = getServerSupabase();
  if (!supabase || !configureWebPush()) return { configured: false, sent: 0 };

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, subscription')
    .eq('shop_id', shopId);
  if (error) throw error;

  let sent = 0;
  for (const row of subscriptions || []) {
    try {
      await webpush.sendNotification(row.subscription as any, JSON.stringify(payload));
      sent += 1;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
      } else {
        console.error('[Push] Delivery failed:', error);
      }
    }
  }

  return { configured: true, sent };
}
