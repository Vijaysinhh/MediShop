"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, QrCode, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";

type Shop = { id: string; name: string; status: string; subscription_plan?: string | null; subscription_ends_at?: string | null };
type PaymentRequest = { id: string; shop_id: string; amount: number; payment_method: string; transaction_reference: string; proof_url: string | null; note: string | null; status: "submitted" | "verified" | "rejected"; submitted_at: string; shops?: { name: string } | null };
const defaultSettings = { upi_id: "", qr_image_url: "", payment_instructions: "Pay using UPI and submit the UTR after payment.", support_phone: "" };

export function SuperadminSubscriptionManager({ shops, reloadShops }: { shops: Shop[]; reloadShops: () => Promise<void> }) {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuth();
  const [settings, setSettings] = useState(defaultSettings);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selected, setSelected] = useState<PaymentRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [planCode, setPlanCode] = useState("monthly");
  const [billingPeriod, setBillingPeriod] = useState("monthly");
  const [endsOn, setEndsOn] = useState("");
  const [manualShopId, setManualShopId] = useState("");
  const [manualPlanCode, setManualPlanCode] = useState("trial");
  const [manualPeriod, setManualPeriod] = useState("trial");
  const [manualEndsOn, setManualEndsOn] = useState(() => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [manualAmount, setManualAmount] = useState("0");
  const [manualPaymentMethod, setManualPaymentMethod] = useState("");
  const [manualReference, setManualReference] = useState("");
  const [manualNotes, setManualNotes] = useState("");

  const load = useCallback(async () => {
    const syncResult = await (supabase as any).rpc("sync_expired_subscriptions");
    if (syncResult.error) toast.error(syncResult.error.message);
    const [settingsResult, requestsResult] = await Promise.all([
      (supabase as any).from("platform_billing_settings").select("*").eq("id", true).maybeSingle(),
      (supabase as any).from("subscription_payment_requests").select("*, shops(name)").order("submitted_at", { ascending: false }),
    ]);
    if (settingsResult.data) setSettings({ ...defaultSettings, ...settingsResult.data });
    if (requestsResult.error) toast.error(requestsResult.error.message); else setRequests(requestsResult.data || []);
  }, [supabase]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!manualShopId && shops[0]?.id) setManualShopId(shops[0].id);
  }, [manualShopId, shops]);

  const saveSettings = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from("platform_billing_settings").upsert({ id: true, ...settings, updated_by: user?.id, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Platform payment details saved.");
  };

  const review = async (status: "verified" | "rejected") => {
    if (!selected) return;
    if (status === "verified" && billingPeriod === "custom" && !endsOn) { toast.error("Choose a subscription end date."); return; }
    setSaving(true);
    try {
      const reviewResult = await (supabase as any).rpc("review_subscription_payment", {
        p_request_id: selected.id,
        p_decision: status,
        p_plan_code: status === "verified" ? planCode : null,
        p_billing_period: status === "verified" ? billingPeriod : null,
        p_custom_ends_at: status === "verified" && endsOn ? new Date(`${endsOn}T23:59:59`).toISOString() : null,
        p_rejection_reason: null,
      });
      if (reviewResult.error) throw reviewResult.error;
      toast.success(status === "verified" ? "Payment verified and pharmacy activated." : "Payment request rejected.");
      setSelected(null); await Promise.all([load(), reloadShops()]);
    } catch (error: any) { toast.error(error?.message || "Could not update subscription payment."); }
    finally { setSaving(false); }
  };

  const saveManualSubscription = async () => {
    const amount = Number(manualAmount);
    if (!manualShopId || !manualPlanCode.trim() || !manualEndsOn || !Number.isFinite(amount) || amount < 0) {
      toast.error("Choose a pharmacy, plan, future end date, and valid amount.");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).rpc("set_shop_subscription", {
      p_shop_id: manualShopId,
      p_plan_code: manualPlanCode.trim(),
      p_billing_period: manualPeriod,
      p_ends_at: new Date(`${manualEndsOn}T23:59:59`).toISOString(),
      p_amount: amount,
      p_payment_method: manualPaymentMethod.trim() || null,
      p_transaction_reference: manualReference.trim() || null,
      p_notes: manualNotes.trim() || "Manual subscription change by Superadmin",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Subscription saved and pharmacy activated.");
    await Promise.all([load(), reloadShops()]);
  };

  const pending = requests.filter((request) => request.status === "submitted");
  return <div className="grid gap-5 lg:grid-cols-[1fr_1.35fr]">
    <Card><CardHeader><div className="flex items-center gap-2"><span className="rounded-xl bg-teal-50 p-2 text-teal-700"><QrCode className="h-5 w-5" /></span><div><CardTitle>Platform payment details</CardTitle><CardDescription>Shown to shop owners when they renew MediShop.</CardDescription></div></div></CardHeader><CardContent className="space-y-4"><div><Label htmlFor="upi">UPI ID</Label><Input id="upi" value={settings.upi_id} onChange={(event) => setSettings({ ...settings, upi_id: event.target.value })} placeholder="medishop@upi" /></div><div><Label htmlFor="qr">QR image URL</Label><Input id="qr" value={settings.qr_image_url} onChange={(event) => setSettings({ ...settings, qr_image_url: event.target.value })} placeholder="https://…" /></div><div><Label htmlFor="support">Support phone</Label><Input id="support" value={settings.support_phone} onChange={(event) => setSettings({ ...settings, support_phone: event.target.value })} /></div><div><Label htmlFor="instructions">Payment instructions</Label><Textarea id="instructions" value={settings.payment_instructions} onChange={(event) => setSettings({ ...settings, payment_instructions: event.target.value })} /></div><Button className="w-full" onClick={() => void saveSettings()} disabled={saving}>{saving ? "Saving…" : "Save payment details"}</Button></CardContent></Card>
    <Card><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Payment verification queue</CardTitle><CardDescription>{pending.length} payment {pending.length === 1 ? "request" : "requests"} awaiting review.</CardDescription></div><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div></CardHeader><CardContent className="space-y-3">{requests.length ? requests.map((request) => <button key={request.id} type="button" onClick={() => { setSelected(request); setPlanCode("monthly"); setBillingPeriod("monthly"); setEndsOn(""); }} className="flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition hover:border-teal-300 hover:bg-teal-50/30"><div><p className="font-semibold">{request.shops?.name || "Medical shop"}</p><p className="mt-1 text-sm text-muted-foreground">₹{Number(request.amount).toFixed(2)} · {request.payment_method.toUpperCase()} · {request.transaction_reference}</p><p className="mt-1 text-xs text-muted-foreground">Submitted {new Date(request.submitted_at).toLocaleDateString("en-IN")}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${request.status === "verified" ? "bg-emerald-100 text-emerald-800" : request.status === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{request.status}</span></button>) : <div className="rounded-2xl border border-dashed p-9 text-center text-muted-foreground"><CreditCard className="mx-auto mb-3 h-7 w-7" />No subscription payments submitted yet.</div>}</CardContent></Card>
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Manual subscription control</CardTitle>
        <CardDescription>Assign, extend, or correct any pharmacy subscription. Every save adds a history record.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="manual-shop">Medical shop</Label>
          <select id="manual-shop" value={manualShopId} onChange={(event) => setManualShopId(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Choose a pharmacy</option>
            {shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="manual-plan">Plan name</Label>
          <Input id="manual-plan" value={manualPlanCode} onChange={(event) => setManualPlanCode(event.target.value)} placeholder="Trial, Standard, Premium..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manual-period">Billing period</Label>
          <select id="manual-period" value={manualPeriod} onChange={(event) => setManualPeriod(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="trial">Trial</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="custom">Custom</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="manual-end">Valid until</Label>
          <Input id="manual-end" type="date" min={new Date().toISOString().slice(0, 10)} value={manualEndsOn} onChange={(event) => setManualEndsOn(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manual-amount">Amount</Label>
          <Input id="manual-amount" inputMode="decimal" value={manualAmount} onChange={(event) => setManualAmount(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manual-method">Payment method</Label>
          <Input id="manual-method" value={manualPaymentMethod} onChange={(event) => setManualPaymentMethod(event.target.value)} placeholder="UPI, cash, complimentary..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manual-reference">Reference</Label>
          <Input id="manual-reference" value={manualReference} onChange={(event) => setManualReference(event.target.value)} />
        </div>
        <div className="space-y-2 lg:col-span-3">
          <Label htmlFor="manual-notes">Notes</Label>
          <Input id="manual-notes" value={manualNotes} onChange={(event) => setManualNotes(event.target.value)} placeholder="Reason for the change" />
        </div>
        <div className="flex items-end">
          <Button className="w-full" onClick={() => void saveManualSubscription()} disabled={saving || !shops.length}>{saving ? "Saving…" : "Save subscription"}</Button>
        </div>
      </CardContent>
    </Card>
    <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle>Review subscription payment</DialogTitle>
          <DialogDescription>{selected?.shops?.name} · ₹{selected ? Number(selected.amount).toFixed(2) : "0.00"}</DialogDescription>
        </DialogHeader>
        {selected && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-5">
            <div className="break-words rounded-xl bg-muted/50 p-3 text-sm">
              <p><strong>UTR / reference:</strong> {selected.transaction_reference}</p>
              {selected.note && <p className="mt-1"><strong>Note:</strong> {selected.note}</p>}
              {selected.proof_url && (
                <a className="mt-2 inline-block text-teal-700 underline" href={selected.proof_url} target="_blank" rel="noreferrer">
                  View payment proof
                </a>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="renew-plan">Plan name</Label>
                <Input id="renew-plan" value={planCode} onChange={(event) => setPlanCode(event.target.value)} placeholder="Standard, Premium..." />
              </div>
              <div>
                <Label htmlFor="renew-period">Billing period</Label>
                <select id="renew-period" value={billingPeriod} onChange={(event) => setBillingPeriod(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="ends-on">Override valid-until date</Label>
                <Input id="ends-on" type="date" value={endsOn} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setEndsOn(event.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">Leave blank for automatic extension from the current expiry. Custom billing requires a date.</p>
              </div>
            </div>
          </div>
        )}
        <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4 sm:justify-between">
          <Button variant="destructive" onClick={() => void review("rejected")} disabled={saving}>
            <XCircle className="mr-2 h-4 w-4" />Reject
          </Button>
          <Button onClick={() => void review("verified")} disabled={saving}>
            <CheckCircle2 className="mr-2 h-4 w-4" />Mark paid & activate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
