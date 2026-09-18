import { NextRequest, NextResponse } from 'next/server';
import { savePushSubscription } from '@/lib/push-server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const shopId = Number(body.shopId);
    const userId = body.userId === undefined || body.userId === null ? null : Number(body.userId);

    if (!Number.isFinite(shopId) || shopId <= 0 || !body.subscription?.endpoint) {
      return NextResponse.json({ error: 'Invalid push subscription request.' }, { status: 400 });
    }

    await savePushSubscription({ shopId, userId, subscription: body.subscription });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Push] Subscription failed:', error);
    return NextResponse.json({ error: 'Unable to save push subscription.' }, { status: 500 });
  }
}

