"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CreditCard, LogOut } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

type GateStatus = "checking" | "active" | "dueSoon" | "locked";

interface SubscriptionCheckProps { children: React.ReactNode }

function validUntil(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function SubscriptionCheck({ children }: SubscriptionCheckProps) {
  const { user, currentShop, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<GateStatus>("checking");
  const [plan, setPlan] = useState("subscription");
  const [endsAt, setEndsAt] = useState<string | null>(null);

  const shouldCheck = Boolean(
    user && user.role !== "super_admin" && currentShop?.id &&
    !pathname?.startsWith("/login") && !pathname?.startsWith("/super-admin") &&
    !pathname?.startsWith("/subscription"),
  );

  useEffect(() => {
    let cancelled = false;
    async function checkSubscription() {
      if (!shouldCheck) { setStatus("active"); return; }
      setStatus("checking");
      const { data: shop, error } = await (supabase as any)
        .from("shops")
        .select("status,subscription_plan,subscription_ends_at")
        .eq("id", currentShop!.id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !shop) {
        // A temporary API failure must not incorrectly lock an authenticated shop.
        setStatus("active");
        return;
      }

      const expiry = validUntil(shop.subscription_ends_at);
      setPlan(shop.subscription_plan || "subscription");
      setEndsAt(shop.subscription_ends_at || null);
      if (shop.status !== "active" || !expiry || expiry <= Date.now()) {
        setStatus("locked");
        return;
      }
      const warningWindow = 7 * 24 * 60 * 60 * 1000;
      setStatus(expiry - Date.now() <= warningWindow ? "dueSoon" : "active");
    }
    void checkSubscription();
    return () => { cancelled = true; };
  }, [currentShop, shouldCheck, supabase]);

  if (!shouldCheck) return <>{children}</>;
  if (status === "checking") {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="text-center"><div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700" /><p className="text-sm text-slate-600">Checking pharmacy access…</p></div></div>;
  }
  if (status === "locked") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-teal-50 to-white p-4">
        <section className="w-full max-w-md rounded-3xl border bg-white p-7 text-center shadow-xl sm:p-9">
          <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><CreditCard className="h-7 w-7" /></span>
          <h1 className="text-2xl font-bold text-slate-900">Subscription required</h1>
          <p className="mt-2 text-sm text-slate-600">This pharmacy is paused or its {plan} access has expired. Submit a renewal payment or contact the MediShop administrator.</p>
          <div className="mt-6 space-y-3">
            <Button className="w-full" onClick={() => router.push("/subscription")}>View payment details</Button>
            <Button variant="outline" className="w-full" onClick={async () => { await logout(); router.replace("/login"); }}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
          </div>
        </section>
      </main>
    );
  }
  return (
    <>
      {status === "dueSoon" && <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><span>Your {plan} access ends {endsAt ? new Date(endsAt).toLocaleDateString("en-IN") : "soon"}.</span><Button size="sm" variant="outline" onClick={() => router.push("/subscription")}>Manage subscription</Button></div></div>}
      {children}
    </>
  );
}
