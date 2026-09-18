"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Settings2, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Category = { id: string; name: string; color: string | null };

export function Settings() {
  const { currentShop, user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [preferences, setPreferences] = useState({ invoicePrefix: "MS", invoiceFooter: "", expiryDays: "90", negativeStock: false });
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState("#0f766e");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!currentShop?.id) return;
    const [settingsResult, categoriesResult] = await Promise.all([
      (supabase as any).from("shop_settings").select("invoice_prefix,invoice_footer,expiry_warning_days,allow_negative_stock").eq("shop_id", currentShop.id).maybeSingle(),
      (supabase as any).from("medicine_categories").select("id,name,color").eq("shop_id", currentShop.id).order("name"),
    ]);
    if (settingsResult.error) toast.error(settingsResult.error.message);
    else if (settingsResult.data) setPreferences({ invoicePrefix: settingsResult.data.invoice_prefix, invoiceFooter: settingsResult.data.invoice_footer || "", expiryDays: String(settingsResult.data.expiry_warning_days), negativeStock: settingsResult.data.allow_negative_stock });
    if (categoriesResult.error) toast.error(categoriesResult.error.message); else setCategories(categoriesResult.data || []);
  }, [currentShop?.id, supabase]);
  useEffect(() => { void load(); }, [load]);

  if (!user || !["owner", "manager"].includes(user.role)) return <div className="mx-auto max-w-3xl rounded-3xl border p-10 text-center"><h1 className="text-xl font-bold">Access denied</h1><p className="mt-2 text-muted-foreground">Only owners and managers can change pharmacy settings.</p></div>;

  async function savePreferences() {
    if (!currentShop?.id) return;
    const days = Number(preferences.expiryDays);
    if (!preferences.invoicePrefix.trim() || !Number.isInteger(days) || days < 1 || days > 730) { toast.error("Enter an invoice prefix and expiry warning between 1 and 730 days."); return; }
    setSaving(true);
    const { error } = await (supabase as any).from("shop_settings").upsert({ shop_id: currentShop.id, currency: "INR", locale: "en-IN", invoice_prefix: preferences.invoicePrefix.trim(), invoice_footer: preferences.invoiceFooter.trim() || null, expiry_warning_days: days, allow_negative_stock: preferences.negativeStock }, { onConflict: "shop_id" });
    setSaving(false); error ? toast.error(error.message) : toast.success("Pharmacy preferences saved.");
  }
  async function saveCategory() {
    if (!currentShop?.id || categoryName.trim().length < 2) { toast.error("Enter a category name."); return; }
    setSaving(true);
    const payload = { shop_id: currentShop.id, name: categoryName.trim(), color: categoryColor };
    const result = editing ? await (supabase as any).from("medicine_categories").update(payload).eq("id", editing.id).eq("shop_id", currentShop.id) : await (supabase as any).from("medicine_categories").insert(payload);
    setSaving(false);
    if (result.error) { toast.error(result.error.message); return; }
    toast.success(editing ? "Category updated." : "Category added."); setCategoryOpen(false); await load();
  }
  async function removeCategory(category: Category) {
    if (!currentShop?.id || !window.confirm(`Delete ${category.name}? Medicines will remain uncategorised.`)) return;
    const { error } = await (supabase as any).from("medicine_categories").delete().eq("id", category.id).eq("shop_id", currentShop.id);
    if (error) toast.error(error.message); else { toast.success("Category deleted."); await load(); }
  }

  return <div className="mx-auto max-w-5xl space-y-6 pb-24 pt-3 sm:pb-10">
    <section className="rounded-3xl bg-gradient-to-br from-slate-950 to-teal-800 p-6 text-white shadow-xl"><div className="flex items-center gap-4"><span className="rounded-2xl bg-white/10 p-3"><Settings2 className="h-6 w-6" /></span><div><p className="text-sm text-teal-100">Pharmacy configuration</p><h1 className="text-3xl font-bold">Settings</h1><p className="mt-1 text-sm text-slate-200">Billing preferences and medicine catalogue setup.</p></div></div></section>
    <Tabs defaultValue="general"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="general">General</TabsTrigger><TabsTrigger value="categories">Medicine categories</TabsTrigger></TabsList>
      <TabsContent value="general" className="mt-5"><Card><CardHeader><CardTitle>Billing and stock preferences</CardTitle><CardDescription>These settings apply only to {currentShop?.name}.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Invoice prefix"><Input value={preferences.invoicePrefix} onChange={(e) => setPreferences({ ...preferences, invoicePrefix: e.target.value })} /></Field><Field label="Expiry warning days"><Input type="number" min="1" max="730" value={preferences.expiryDays} onChange={(e) => setPreferences({ ...preferences, expiryDays: e.target.value })} /></Field></div><Field label="Invoice footer"><Textarea value={preferences.invoiceFooter} onChange={(e) => setPreferences({ ...preferences, invoiceFooter: e.target.value })} /></Field><label className="flex gap-3 rounded-2xl border p-4"><input type="checkbox" className="mt-1 h-4 w-4" checked={preferences.negativeStock} onChange={(e) => setPreferences({ ...preferences, negativeStock: e.target.checked })} /><span><span className="block text-sm font-semibold">Allow negative stock</span><span className="text-xs text-muted-foreground">Not recommended for batch-controlled pharmacy inventory.</span></span></label><Button onClick={() => void savePreferences()} disabled={saving}>{saving ? "Saving…" : "Save preferences"}</Button></CardContent></Card></TabsContent>
      <TabsContent value="categories" className="mt-5"><Card><CardHeader className="flex-row items-start justify-between"><div><CardTitle className="flex items-center gap-2"><Tags className="h-5 w-5 text-teal-700" />Medicine categories</CardTitle><CardDescription>Categories now live here instead of on a duplicate page.</CardDescription></div><Button size="sm" onClick={() => { setEditing(null); setCategoryName(""); setCategoryColor("#0f766e"); setCategoryOpen(true); }}><Plus className="mr-1 h-4 w-4" />Add</Button></CardHeader><CardContent>{categories.length ? <div className="divide-y rounded-2xl border">{categories.map((category) => <div key={category.id} className="flex items-center gap-3 p-3"><span className="h-4 w-4 rounded-full" style={{ backgroundColor: category.color || "#0f766e" }} /><span className="flex-1 font-medium">{category.name}</span><Button variant="ghost" size="icon" onClick={() => { setEditing(category); setCategoryName(category.name); setCategoryColor(category.color || "#0f766e"); setCategoryOpen(true); }}><Edit3 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-red-600" onClick={() => void removeCategory(category)}><Trash2 className="h-4 w-4" /></Button></div>)}</div> : <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">No medicine categories yet.</div>}</CardContent></Card></TabsContent>
    </Tabs>
    <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}><DialogContent><DialogHeader><DialogTitle>{editing ? "Edit category" : "Add category"}</DialogTitle><DialogDescription>Create a clear pharmacy catalogue group.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-[1fr_100px]"><Field label="Name"><Input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} autoFocus /></Field><Field label="Colour"><Input type="color" value={categoryColor} onChange={(e) => setCategoryColor(e.target.value)} /></Field></div><DialogFooter><Button variant="outline" onClick={() => setCategoryOpen(false)}>Cancel</Button><Button onClick={() => void saveCategory()} disabled={saving}>{saving ? "Saving…" : "Save category"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
