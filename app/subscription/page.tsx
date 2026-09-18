"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, QrCode, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";

type BillingSettings = { upi_id: string | null; qr_image_url: string | null; payment_instructions: string | null; support_phone: string | null };
type PaymentRequest = { id: string; amount: number; payment_method: string; transaction_reference: string; status: string; submitted_at: string; rejection_reason: string | null };

export default function SubscriptionPage() {
  const { user, currentShop, isLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!currentShop?.id) return;
    const [settingsResult, requestsResult] = await Promise.all([
      (supabase as any).from("platform_billing_settings").select("upi_id,qr_image_url,payment_instructions,support_phone").eq("id", true).maybeSingle(),
      (supabase as any).from("subscription_payment_requests").select("id,amount,payment_method,transaction_reference,status,submitted_at,rejection_reason").eq("shop_id", currentShop.id).order("submitted_at", { ascending: false }),
    ]);
    if (settingsResult.error) toast.error(settingsResult.error.message); else setSettings(settingsResult.data);
    if (requestsResult.error) toast.error(requestsResult.error.message); else setRequests(requestsResult.data || []);
  }, [currentShop?.id, supabase]);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    const parsedAmount = Number(amount);
    if (!currentShop?.id || !user?.id) return;
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !reference.trim()) {
      toast.error("Enter the amount paid and the UTR / payment reference.");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("subscription_payment_requests").insert({
      shop_id: currentShop.id,
      amount: parsedAmount,
      payment_method: "upi",
      transaction_reference: reference.trim(),
      proof_url: proofUrl.trim() || null,
      note: note.trim() || null,
      submitted_by: user.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setAmount(""); setReference(""); setProofUrl(""); setNote("");
    toast.success("Payment submitted for verification.");
    await load();
  };

  if (isLoading || !currentShop || !user || !["owner", "manager"].includes(user.role)) return null;
  const activeUntil = currentShop.subscription_ends_at ? new Date(currentShop.subscription_ends_at).toLocaleDateString("en-IN") : "Not set";

  return <main className="mx-auto max-w-5xl space-y-6 pb-12 pt-4">
    <section className="rounded-3xl bg-gradient-to-br from-slate-900 to-teal-800 p-6 text-white shadow-xl sm:p-8"><div className="flex gap-4"><span className="rounded-2xl bg-white/15 p-3"><CreditCard className="h-7 w-7" /></span><div><p className="text-sm text-teal-100">MediShop subscription</p><h1 className="text-3xl font-bold">Keep {currentShop.name} active</h1><p className="mt-2 text-sm text-slate-200">Current plan: {currentShop.subscription_plan || "trial"} · Valid until: {activeUntil}</p></div></div></section>
    <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><div className="flex items-center gap-2"><QrCode className="h-5 w-5 text-teal-700" /><div><CardTitle>1. Make payment</CardTitle><CardDescription>Use the platform UPI details below. Do not pay to a customer or supplier QR.</CardDescription></div></div></CardHeader><CardContent className="space-y-4">{settings?.qr_image_url && <img src={settings.qr_image_url} alt="MediShop platform payment QR code" className="mx-auto max-h-52 rounded-xl border bg-white p-2" />}{settings?.upi_id && <div className="rounded-xl border bg-muted/40 p-3"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">UPI ID</p><p className="mt-1 font-semibold">{settings.upi_id}</p></div>}<p className="whitespace-pre-line text-sm text-muted-foreground">{settings?.payment_instructions || "Platform payment details will be added by the Superadmin."}</p>{settings?.support_phone && <p className="text-sm">Support: <a className="font-medium text-teal-700 underline" href={`tel:${settings.support_phone}`}>{settings.support_phone}</a></p>}</CardContent></Card>
      <Card><CardHeader><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-teal-700" /><div><CardTitle>2. Submit payment for review</CardTitle><CardDescription>Verification is manual; your plan is not extended until Superadmin approves it.</CardDescription></div></div></CardHeader><CardContent className="space-y-4"><div><Label htmlFor="amount">Amount paid (₹) *</Label><Input id="amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="e.g. 299" /></div><div><Label htmlFor="utr">UPI UTR / transaction reference *</Label><Input id="utr" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Enter the confirmation number" /></div><div><Label htmlFor="proof">Payment proof URL (optional)</Label><Input id="proof" type="url" value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} placeholder="A secure uploaded receipt link" /></div><div><Label htmlFor="note">Note (optional)</Label><Textarea id="note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Any useful details for verification" /></div><Button className="w-full" onClick={() => void submit()} disabled={saving}>{saving ? "Submitting…" : <><Send className="mr-2 h-4 w-4" />Submit for verification</>}</Button></CardContent></Card></div>
    <Card><CardHeader><CardTitle>Payment requests</CardTitle><CardDescription>Your recent submissions and verification status.</CardDescription></CardHeader><CardContent className="space-y-3">{requests.length ? requests.map((request) => <div key={request.id} className="flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">₹{Number(request.amount).toFixed(2)} · {request.transaction_reference}</p><p className="text-sm text-muted-foreground">Submitted {new Date(request.submitted_at).toLocaleString("en-IN")}</p>{request.rejection_reason && <p className="mt-1 text-sm text-red-700">Reason: {request.rejection_reason}</p>}</div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${request.status === "verified" ? "bg-emerald-100 text-emerald-800" : request.status === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{request.status}</span></div>) : <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No renewal payments have been submitted.</div>}</CardContent></Card>
  </main>;
}
