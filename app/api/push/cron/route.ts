import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  claimPushDelivery,
  isPushConfigured,
  sendPushToShop,
  type PushPayload,
} from '@/lib/push-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function dispatch(shopId: number, kind: string, key: string, payload: PushPayload) {
  const claimed = await claimPushDelivery(shopId, `${key}-${dayKey()}`, kind);
  if (!claimed) return 0;
  const result = await sendPushToShop(shopId, payload);
  return result.sent;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json({ error: 'VAPID keys are not configured.' }, { status: 503 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase server configuration is missing.' }, { status: 503 });
  }

  try {
    const [{ data: items, error: itemsError }, { data: customers, error: customersError }, { data: entries, error: entriesError }] = await Promise.all([
      supabase.from('items').select('id, shop_id, name, name_marathi, quantity, low_stock_limit, expiry_date'),
      supabase.from('credit_customers').select('id, shop_id, name, balance'),
      supabase.from('credit_entries').select('customer_id, timestamp'),
    ]);
    if (itemsError) throw itemsError;
    if (customersError) throw customersError;
    if (entriesError) throw entriesError;

    const latestCreditActivity = new Map<number, number>();
    for (const entry of entries || []) {
      const timestamp = new Date(entry.timestamp).getTime();
      latestCreditActivity.set(entry.customer_id, Math.max(latestCreditActivity.get(entry.customer_id) || 0, timestamp));
    }

    const now = Date.now();
    const sevenDaysAhead = now + 7 * 24 * 60 * 60 * 1000;
    let sent = 0;

    for (const item of items || []) {
      const name = item.name || item.name_marathi || 'Item';
      if (Number(item.low_stock_limit || 0) > 0 && Number(item.quantity) <= Number(item.low_stock_limit)) {
        sent += await dispatch(item.shop_id, 'low_stock', `low-stock-${item.id}`, {
          title: 'Low stock',
          body: `${name} has only ${item.quantity} left.`,
          tag: `low-stock-${item.id}`,
          url: `/items?focusItemId=${item.id}&filter=lowStock`,
        });
      }

      if (item.expiry_date) {
        const expiryTime = new Date(item.expiry_date).getTime();
        const expired = expiryTime < now;
        if (expired || expiryTime <= sevenDaysAhead) {
          sent += await dispatch(item.shop_id, expired ? 'expired' : 'expiring', `expiry-${item.id}`, {
            title: expired ? 'Product expired' : 'Expiry reminder',
            body: expired ? `${name} has expired.` : `${name} expires within 7 days.`,
            tag: `expiry-${item.id}`,
            url: `/items?focusItemId=${item.id}&filter=${expired ? 'expired' : 'expiring'}`,
          });
        }
      }
    }

    for (const customer of customers || []) {
      const lastActivity = latestCreditActivity.get(customer.id) || 0;
      const daysIdle = lastActivity ? Math.floor((now - lastActivity) / (24 * 60 * 60 * 1000)) : 0;
      if (Number(customer.balance) > 0 && daysIdle >= 15) {
        sent += await dispatch(customer.shop_id, 'credit_overdue', `credit-${customer.id}`, {
          title: 'Udhari payment overdue',
          body: `${customer.name} has Rs. ${customer.balance} pending.`,
          tag: `credit-${customer.id}`,
          url: `/udhari?focusCustomerId=${customer.id}`,
        });
      }
    }

    return NextResponse.json({ ok: true, sent });
  } catch (error) {
    console.error('[Push] Scheduled notification check failed:', error);
    return NextResponse.json({ error: 'Scheduled notification check failed.' }, { status: 500 });
  }
}

