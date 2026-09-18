import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { claimPushDelivery, isPushConfigured, sendPushToShop, type PushPayload } from "@/lib/push-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const shopId = Number(body.shopId);
    const kind = String(body.kind || "activity");
    const title = String(body.title || "Dukan activity");
    const message = String(body.body || "You have a new shop update.");
    const tag = String(body.tag || `${kind}-${shopId}`);
    const url = String(body.url || "/dashboard");
    const dedupeKey = body.dedupeKey ? String(body.dedupeKey) : `${kind}-${shopId}-${Date.now()}`;

    if (!Number.isFinite(shopId) || shopId <= 0) {
      return NextResponse.json({ error: "Invalid shop id" }, { status: 400 });
    }

    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase server configuration is missing." }, { status: 503 });
    }

    const payload: PushPayload = {
      title,
      body: message,
      tag,
      url,
      renotify: true,
    };

    const claimed = await claimPushDelivery(shopId, dedupeKey, kind);
    if (!claimed) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const { error } = await supabase.from("alerts").insert({
      shop_id: shopId,
      item_id: Number(body.itemId || 0),
      item_name: String(body.itemName || "Shop activity"),
      alert_type: body.alertType || "slow_moving",
      message,
      severity: body.severity || "info",
      data: body.data || {},
      read: false,
      created_at: new Date().toISOString(),
    });

    if (error) throw error;

    if (!isPushConfigured()) {
      return NextResponse.json({ ok: true, stored: true, pushed: false });
    }

    const result = await sendPushToShop(shopId, payload);
    return NextResponse.json({ ok: true, stored: true, pushed: result.configured, sent: result.sent });
  } catch (error) {
    console.error("[Push] Notify failed:", error);
    return NextResponse.json({ error: "Unable to create notification." }, { status: 500 });
  }
}
