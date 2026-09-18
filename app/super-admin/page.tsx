"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CirclePause, Pencil, Plus, ShieldCheck, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { SuperadminSubscriptionManager } from "@/components/superadmin-subscription-manager";

type ShopRow = {
  id: string;
  name: string;
  legal_name: string | null;
  drug_license_number: string | null;
  address: string | null;
  status: "active" | "paused" | "archived";
  subscription_plan: string | null;
  subscription_ends_at: string | null;
  billing_period: string | null;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  created_at: string;
};

const emptyForm = {
  name: "", legalName: "", drugLicense: "", address: "",
  ownerName: "", ownerEmail: "", ownerPassword: "",
  planCode: "trial", billingPeriod: "trial", subscriptionEndsAt: "",
};

async function readApiResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json();
  const text = await response.text();
  return { error: response.redirected ? "Your session expired. Sign in again and retry." : text.match(/<title>(.*?)<\/title>/i)?.[1] || `Server returned ${response.status}.` };
}

export default function SuperAdminPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<ShopRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const supabase = useMemo(() => createClient(), []);

  const loadShops = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/superadmin/shops", { headers: { Authorization: `Bearer ${sessionData.session?.access_token || ""}` } });
    const result = await readApiResponse(response);
    if (!response.ok) { toast.error(result.error || "Could not load medical shops."); return; }
    setShops(result.shops || []);
  }, [supabase]);

  useEffect(() => {
    if (!isLoading && user?.role !== "super_admin") router.replace("/login");
    if (user?.role === "super_admin") void loadShops();
  }, [isLoading, loadShops, router, user?.role]);

  const createShop = async () => {
    if (saving) return;
    if (form.name.trim().length < 2 || !form.ownerName.trim() || !form.ownerEmail.trim() || (!editingShop && form.ownerPassword.length < 8) || (editingShop && form.ownerPassword.length > 0 && form.ownerPassword.length < 8)) {
      toast.error(editingShop ? "Enter the pharmacy and owner details. A new password must have at least 8 characters." : "Enter pharmacy details plus the owner name, email, and an 8-character temporary password.");
      return;
    }
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (editingShop) {
        const response = await fetch("/api/superadmin/shops", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session?.access_token || ""}` },
          body: JSON.stringify({ shopId: editingShop.id, pharmacyName: form.name, legalName: form.legalName, drugLicense: form.drugLicense, address: form.address, ownerName: form.ownerName, ownerEmail: form.ownerEmail, ownerPassword: form.ownerPassword || undefined, planCode: form.planCode, billingPeriod: form.billingPeriod, subscriptionEndsAt: form.subscriptionEndsAt ? new Date(`${form.subscriptionEndsAt}T23:59:59`).toISOString() : null }),
        });
        const result = await readApiResponse(response);
        if (!response.ok) throw new Error(result.error || "Could not update the medical shop.");
        toast.success(form.ownerPassword ? "Medical shop and owner login updated." : "Medical shop and owner details updated.");
        setOpen(false);
        setEditingShop(null);
        setForm(emptyForm);
        await loadShops();
        return;
      }
      const response = await fetch("/api/superadmin/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session?.access_token || ""}` },
        body: JSON.stringify({
          pharmacyName: form.name, legalName: form.legalName, drugLicense: form.drugLicense,
          address: form.address, ownerName: form.ownerName, ownerEmail: form.ownerEmail,
          ownerPassword: form.ownerPassword, planCode: form.planCode, billingPeriod: form.billingPeriod,
          subscriptionEndsAt: form.subscriptionEndsAt ? new Date(`${form.subscriptionEndsAt}T23:59:59`).toISOString() : null,
        }),
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error || "Could not create medical shop.");
      toast.success("Medical shop and owner account created.");
      setOpen(false);
      setForm(emptyForm);
      await loadShops();
    } catch (error: any) {
      toast.error(error?.message || "Could not save medical shop.");
    } finally { setSaving(false); }
  };

  const togglePause = async (shop: ShopRow) => {
    const nextStatus = shop.status === "paused" ? "active" : "paused";
    const { error } = await (supabase as any).from("shops").update({
      status: nextStatus,
      paused_reason: nextStatus === "paused" ? "Paused by platform administrator" : null,
    }).eq("id", shop.id);
    if (error) { toast.error(error.message); return; }
    toast.success(nextStatus === "paused" ? "Shop paused." : "Shop reactivated.");
    await loadShops();
  };

  const editShop = (shop: ShopRow) => {
    setEditingShop(shop);
    setForm({ ...emptyForm, name: shop.name, legalName: shop.legal_name || "", drugLicense: shop.drug_license_number || "", address: shop.address || "", ownerName: shop.owner_name || "", ownerEmail: shop.owner_email || "", planCode: shop.subscription_plan || "custom", billingPeriod: shop.billing_period || "custom", subscriptionEndsAt: shop.subscription_ends_at ? new Date(shop.subscription_ends_at).toISOString().slice(0, 10) : "" });
    setOpen(true);
  };

  const deleteShop = async (shop: ShopRow) => {
    if (!window.confirm(`Delete ${shop.name}? This permanently removes its pharmacy data and owner membership.`)) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/superadmin/shops", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session?.access_token || ""}` },
      body: JSON.stringify({ shopId: shop.id }),
    });
    const result = await readApiResponse(response);
    if (!response.ok && !result.shopDeleted) { toast.error(result.error || "Could not delete the medical shop."); return; }
    if (result.shopDeleted) toast.warning(result.error);
    else toast.success("Medical shop and its unused login accounts were deleted.");
    await loadShops();
  };

  if (isLoading || user?.role !== "super_admin") return null;
  const activeCount = shops.filter((shop) => shop.status === "active").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12 pt-4">
      <section className="rounded-3xl bg-gradient-to-br from-slate-900 to-teal-800 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-teal-100"><ShieldCheck className="h-5 w-5" />Platform control</div>
            <h1 className="text-3xl font-bold">MediShop Superadmin</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-200">Create, pause, and oversee pharmacies without entering their operational data.</p>
          </div>
          <Button className="bg-amber-400 text-slate-950 hover:bg-amber-300" onClick={() => { setEditingShop(null); setForm(emptyForm); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Create medical shop
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardDescription>Total pharmacies</CardDescription><CardTitle className="text-3xl">{shops.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Active</CardDescription><CardTitle className="text-3xl text-emerald-700">{activeCount}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Paused</CardDescription><CardTitle className="text-3xl text-amber-700">{shops.filter((shop) => shop.status === "paused").length}</CardTitle></CardHeader></Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Medical shops</CardTitle><CardDescription>Each shop has isolated data, an owner account, and a subscription history.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {shops.length ? shops.map((shop) => (
            <div key={shop.id} className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-teal-50 p-2 text-teal-700"><Store className="h-5 w-5" /></span>
                <div>
                  <p className="font-semibold">{shop.name}</p>
                  <p className="text-sm text-muted-foreground">{shop.drug_license_number || "Drug licence not recorded"}</p>
                  <p className="mt-1 text-xs font-medium capitalize text-muted-foreground">{shop.status}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => editShop(shop)}><Pencil className="mr-1 h-4 w-4" />Edit</Button>
                <Button variant="outline" size="sm" onClick={() => void togglePause(shop)}><CirclePause className="mr-1 h-4 w-4" />{shop.status === "paused" ? "Reactivate" : "Pause"}</Button>
                <Button variant="destructive" size="sm" onClick={() => void deleteShop(shop)}><Trash2 className="mr-1 h-4 w-4" />Delete</Button>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground"><Building2 className="mx-auto mb-3 h-8 w-8" />No medical shops yet. Create the first one to begin onboarding its owner.</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12 text-left">
            <DialogTitle>{editingShop ? "Edit medical shop" : "Create medical shop"}</DialogTitle>
            <DialogDescription>{editingShop ? "Update pharmacy, owner login, password, and subscription details." : "Add pharmacy details, its owner login, and a starting subscription."}</DialogDescription>
          </DialogHeader>

          <form id="pharmacy-form" className="min-h-0 space-y-6 overflow-y-auto overscroll-contain p-6 [scrollbar-gutter:stable]" onSubmit={(event) => { event.preventDefault(); void createShop(); }}>
            <fieldset className="min-w-0 space-y-4" disabled={saving}>
              <legend className="mb-3 text-sm font-semibold">Pharmacy details</legend>
              <div className="space-y-2">
                <Label htmlFor="name">Pharmacy name *</Label>
                <Input id="name" required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. City Care Medical" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="legal">Legal name</Label>
                  <Input id="legal" value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="license">Drug licence</Label>
                  <Input id="license" value={form.drugLicense} onChange={(event) => setForm({ ...form, drugLicense: event.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" rows={2} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
              </div>
            </fieldset>

            <>
                <fieldset className="min-w-0 space-y-4 border-t pt-4" disabled={saving}>
                  <legend className="pr-3 text-sm font-semibold">Owner login</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ownerName">Owner name *</Label>
                      <Input id="ownerName" required autoComplete="name" value={form.ownerName} onChange={(event) => setForm({ ...form, ownerName: event.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ownerEmail">Owner email *</Label>
                      <Input id="ownerEmail" required type="email" autoComplete="username" value={form.ownerEmail} onChange={(event) => setForm({ ...form, ownerEmail: event.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ownerPassword">{editingShop ? "New password" : "Temporary password *"}</Label>
                    <Input id="ownerPassword" required={!editingShop} minLength={8} type="password" autoComplete="new-password" aria-describedby="password-help" value={form.ownerPassword} onChange={(event) => setForm({ ...form, ownerPassword: event.target.value })} placeholder={editingShop ? "Leave blank to keep the current password" : "At least 8 characters"} />
                    <p id="password-help" className="text-xs text-muted-foreground">{editingShop ? "Enter a new password only when you want to reset the owner's login." : "Use at least 8 characters. The owner signs in with this email and password."}</p>
                  </div>
                </fieldset>
                <fieldset className="min-w-0 border-t pt-4" disabled={saving}>
                  <legend className="pr-3 text-sm font-semibold">Starting subscription</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="plan">Plan name</Label>
                      <Input id="plan" value={form.planCode} onChange={(event) => setForm({ ...form, planCode: event.target.value })} placeholder="Trial, Standard, Premium..." />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="period">Billing period</Label>
                      <select id="period" value={form.billingPeriod} onChange={(event) => setForm({ ...form, billingPeriod: event.target.value })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                        <option value="trial">Trial</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="subscription-end">Custom valid-until date</Label>
                      <Input id="subscription-end" type="date" min={new Date().toISOString().slice(0, 10)} value={form.subscriptionEndsAt} onChange={(event) => setForm({ ...form, subscriptionEndsAt: event.target.value })} />
                      <p className="text-xs text-muted-foreground">Optional for trial, monthly, and yearly plans. Leave blank for the automatic date, or choose any future date.</p>
                    </div>
                  </div>
                </fieldset>
            </>
          </form>

          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" form="pharmacy-form" disabled={saving}>{saving ? "Saving..." : editingShop ? "Save changes" : "Create pharmacy"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SuperadminSubscriptionManager shops={shops} reloadShops={loadShops} />
    </div>
  );
}
