"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowRight, CalendarClock, IndianRupee, Clock3,
  HeartPulse, Package, Plus, ReceiptText, RefreshCw, ShoppingCart,
  Truck, Users, WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";

type Medicine = {
  id: string; name: string; generic_name: string | null; reorder_level: number;
  medicine_batches: Array<{ id: string; quantity_available: number; purchase_price: number; expiry_date: string | null }>;
};
type Sale = {
  id: string; invoice_number: string; total_amount: number; payment_method: string; created_at: string;
  customers: { name: string } | null;
  sale_items: Array<{ medicine_name: string; quantity: number; line_total: number }>;
};
type DashboardData = {
  medicines: Medicine[]; todaySales: Sale[]; recentSales: Sale[];
  creditBalance: number; dueRefills: number; draftPurchases: number; suppliers: number;
  dayClose: { counted_cash: number; expected_cash: number; difference: number; notes: string | null } | null;
};

const EMPTY: DashboardData = { medicines: [], todaySales: [], recentSales: [], creditBalance: 0, dueRefills: 0, draftPurchases: 0, suppliers: 0, dayClose: null };
const DAY_MS = 86_400_000;
const money = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);

function localDayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function MetricCard({ icon: Icon, label, value, detail, tone, onClick }: {
  icon: typeof Package; label: string; value: string; detail: string;
  tone: "teal" | "blue" | "amber" | "rose"; onClick: () => void;
}) {
  const colors = { teal: "bg-teal-50 text-teal-700", blue: "bg-blue-50 text-blue-700", amber: "bg-amber-50 text-amber-700", rose: "bg-rose-50 text-rose-700" };
  return <button type="button" onClick={onClick} className="group rounded-3xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg">
    <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${colors[tone]}`}><Icon className="h-5 w-5" /></span>
    <span className="mt-4 block text-sm font-medium text-muted-foreground">{label}</span>
    <span className="mt-1 block text-2xl font-bold tracking-tight">{value}</span>
    <span className="mt-1 block text-xs text-muted-foreground">{detail}</span>
  </button>;
}

export function OwnerDashboard() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { currentShop, user, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [dayCloseOpen, setDayCloseOpen] = useState(false);
  const [countedCash, setCountedCash] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [closingDay, setClosingDay] = useState(false);

  const load = useCallback(async () => {
    if (!currentShop?.id) return;
    setLoading(true);
    const range = localDayRange();
    const businessDate = new Date().toISOString().slice(0, 10);
    const [medicines, todaySales, recentSales, ledger, refills, purchases, suppliers, dayClose] = await Promise.all([
      (supabase as any).from("medicines").select("id,name,generic_name,reorder_level,medicine_batches(id,quantity_available,purchase_price,expiry_date)").eq("shop_id", currentShop.id).eq("is_active", true).order("name"),
      (supabase as any).from("sales").select("id,invoice_number,total_amount,payment_method,created_at,customers(name),sale_items(medicine_name,quantity,line_total)").eq("shop_id", currentShop.id).eq("status", "completed").gte("created_at", range.start).lt("created_at", range.end).order("created_at", { ascending: false }),
      (supabase as any).from("sales").select("id,invoice_number,total_amount,payment_method,created_at,customers(name),sale_items(medicine_name,quantity,line_total)").eq("shop_id", currentShop.id).eq("status", "completed").order("created_at", { ascending: false }).limit(5),
      (supabase as any).from("customer_ledger").select("amount,direction").eq("shop_id", currentShop.id),
      (supabase as any).from("refill_reminders").select("id", { count: "exact", head: true }).eq("shop_id", currentShop.id).eq("status", "active").lte("next_due_on", new Date().toISOString().slice(0, 10)),
      (supabase as any).from("purchases").select("id", { count: "exact", head: true }).eq("shop_id", currentShop.id).eq("status", "draft"),
      (supabase as any).from("suppliers").select("id", { count: "exact", head: true }).eq("shop_id", currentShop.id).eq("is_active", true),
      (supabase as any).from("cash_reconciliations").select("counted_cash,expected_cash,difference,notes").eq("shop_id", currentShop.id).eq("business_date", businessDate).maybeSingle(),
    ]);
    const firstError = [medicines, todaySales, recentSales, ledger, refills, purchases, suppliers, dayClose].find((result) => result.error)?.error;
    if (firstError) {
      toast.error(firstError.message || "Could not load the pharmacy dashboard.");
      setLoading(false);
      return;
    }
    const creditBalance = (ledger.data || []).reduce((sum: number, entry: any) => sum + (entry.direction === "debit" ? Number(entry.amount) : -Number(entry.amount)), 0);
    setData({ medicines: medicines.data || [], todaySales: todaySales.data || [], recentSales: recentSales.data || [], creditBalance: Math.max(0, creditBalance), dueRefills: refills.count || 0, draftPurchases: purchases.count || 0, suppliers: suppliers.count || 0, dayClose: dayClose.data || null });
    setLoading(false);
  }, [currentShop?.id, supabase]);

  useEffect(() => { void load(); }, [load]);

  const inventory = useMemo(() => {
    const now = Date.now();
    let value = 0; let units = 0; let expiring = 0; let expired = 0; let low = 0;
    const risk: Array<{ id: string; name: string; detail: string; severity: "expired" | "expiring" | "low" }> = [];
    data.medicines.forEach((medicine) => {
      const stock = (medicine.medicine_batches || []).reduce((sum, batch) => sum + Number(batch.quantity_available || 0), 0);
      units += stock;
      value += (medicine.medicine_batches || []).reduce((sum, batch) => sum + Number(batch.quantity_available || 0) * Number(batch.purchase_price || 0), 0);
      if (stock <= Number(medicine.reorder_level || 0)) { low += 1; risk.push({ id: medicine.id, name: medicine.name, detail: stock <= 0 ? "Out of stock" : `${stock} left · reorder at ${medicine.reorder_level}`, severity: "low" }); }
      (medicine.medicine_batches || []).forEach((batch) => {
        if (!batch.expiry_date || Number(batch.quantity_available) <= 0) return;
        const days = Math.ceil((new Date(batch.expiry_date).getTime() - now) / DAY_MS);
        if (days < 0) { expired += 1; risk.push({ id: medicine.id, name: medicine.name, detail: `Expired batch · ${batch.quantity_available} units`, severity: "expired" }); }
        else if (days <= 90) { expiring += 1; risk.push({ id: medicine.id, name: medicine.name, detail: `Expires in ${days} days · ${batch.quantity_available} units`, severity: "expiring" }); }
      });
    });
    const priority = { expired: 0, expiring: 1, low: 2 };
    return { value, units, low, expiring, expired, risk: risk.sort((a, b) => priority[a.severity] - priority[b.severity]).slice(0, 5) };
  }, [data.medicines]);

  const revenue = data.todaySales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
  const expectedCash = data.todaySales.filter((sale) => sale.payment_method === "cash").reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
  const topMedicines = useMemo(() => {
    const totals = new Map<string, { name: string; quantity: number; amount: number }>();
    data.todaySales.forEach((sale) => sale.sale_items?.forEach((line) => {
      const current = totals.get(line.medicine_name) || { name: line.medicine_name, quantity: 0, amount: 0 };
      current.quantity += Number(line.quantity); current.amount += Number(line.line_total); totals.set(line.medicine_name, current);
    }));
    return [...totals.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 4);
  }, [data.todaySales]);

  async function closeDay() {
    const counted = Number(countedCash);
    if (!currentShop?.id || !user?.id || !Number.isFinite(counted) || counted < 0) { toast.error("Enter a valid non-negative counted cash amount."); return; }
    setClosingDay(true);
    const { error } = await (supabase as any).from("cash_reconciliations").upsert({
      shop_id: currentShop.id, business_date: new Date().toISOString().slice(0, 10),
      expected_cash: expectedCash, counted_cash: counted, notes: closeNotes.trim() || null, closed_by: user.id,
    }, { onConflict: "shop_id,business_date" });
    setClosingDay(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Day close saved."); setDayCloseOpen(false); await load();
  }

  if (authLoading || loading) return <div className="mx-auto max-w-7xl space-y-4 pb-24 pt-4"><div className="h-48 animate-pulse rounded-3xl bg-teal-100" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[1,2,3,4].map((item) => <div key={item} className="h-40 animate-pulse rounded-3xl bg-muted" />)}</div></div>;

  const firstName = (user?.fullName || user?.username || "Owner").split(/[\s@]/)[0];
  return <div className="mx-auto max-w-7xl space-y-5 pb-24 pt-3 sm:pb-10">
    <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-teal-900 to-teal-700 p-6 text-white shadow-xl sm:p-8">
      <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="mb-4 flex items-center gap-2 text-teal-100"><span className="rounded-xl bg-amber-400 p-2 text-slate-950"><HeartPulse className="h-4 w-4" /></span><span className="font-semibold">{currentShop?.name || "MediShop"}</span></div><p className="text-sm text-teal-100">Pharmacy control centre</p><h1 className="mt-1 text-3xl font-bold sm:text-4xl">Welcome, {firstName}</h1><p className="mt-2 text-sm text-slate-200">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => { setCountedCash(data.dayClose ? String(data.dayClose.counted_cash) : ""); setCloseNotes(data.dayClose?.notes || ""); setDayCloseOpen(true); }}><IndianRupee className="mr-2 h-4 w-4" />{data.dayClose ? "Review day close" : "Close day"}</Button><Button variant="secondary" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button className="bg-amber-400 text-slate-950 hover:bg-amber-300" onClick={() => router.push("/sales")}><Plus className="mr-2 h-4 w-4" />New sale</Button></div>
      </div>
    </section>

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard icon={IndianRupee} label="Today's sales" value={`₹${money(revenue)}`} detail={`${data.todaySales.length} completed bills`} tone="teal" onClick={() => router.push("/sales")} />
      <MetricCard icon={Package} label="Stock value" value={`₹${money(inventory.value)}`} detail={`${data.medicines.length} medicines · ${money(inventory.units)} units`} tone="blue" onClick={() => router.push("/items")} />
      <MetricCard icon={Clock3} label="Expiry risk" value={String(inventory.expired + inventory.expiring)} detail={`${inventory.expired} expired · ${inventory.expiring} within 90 days`} tone="rose" onClick={() => router.push("/items?stock=expiring")} />
      <MetricCard icon={WalletCards} label="Customer credit" value={`₹${money(data.creditBalance)}`} detail={`${data.dueRefills} refills due`} tone="amber" onClick={() => router.push("/udhari")} />
    </section>

    <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold">Needs attention</h2><p className="text-sm text-muted-foreground">Expiry and replenishment priorities</p></div><span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">{inventory.expired + inventory.expiring + inventory.low} alerts</span></div>
        <div className="mt-4 divide-y">{inventory.risk.length ? inventory.risk.map((item, index) => <button key={`${item.id}-${index}`} onClick={() => router.push(`/items?focusItemId=${item.id}`)} className="flex w-full items-center gap-3 py-3 text-left"><span className={`rounded-xl p-2 ${item.severity === "expired" ? "bg-rose-50 text-rose-700" : item.severity === "expiring" ? "bg-orange-50 text-orange-700" : "bg-amber-50 text-amber-700"}`}><AlertTriangle className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.name}</span><span className="block text-xs text-muted-foreground">{item.detail}</span></span><ArrowRight className="h-4 w-4 text-muted-foreground" /></button>) : <div className="rounded-2xl bg-emerald-50 py-10 text-center text-sm font-medium text-emerald-800">No urgent stock or expiry risks</div>}</div>
      </div>
      <div className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Operations</h2><p className="text-sm text-muted-foreground">Work waiting for the owner</p><div className="mt-4 grid grid-cols-2 gap-3">
        {[{ icon: ShoppingCart, value: data.draftPurchases, label: "Draft purchases", path: "/new-stock" }, { icon: CalendarClock, value: data.dueRefills, label: "Refills due", path: "/udhari" }, { icon: Truck, value: data.suppliers, label: "Active suppliers", path: "/new-stock" }, { icon: AlertTriangle, value: inventory.low, label: "Low stock", path: "/items?stock=lowStock" }].map((item) => <button key={item.label} onClick={() => router.push(item.path)} className="rounded-2xl bg-slate-50 p-4 text-left transition hover:bg-teal-50"><item.icon className="h-5 w-5 text-teal-700" /><span className="mt-3 block text-2xl font-bold">{item.value}</span><span className="text-xs text-muted-foreground">{item.label}</span></button>)}
      </div></div>
    </section>

    <section className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-3xl border bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold">Today's top medicines</h2><p className="text-sm text-muted-foreground">Based on completed bills</p></div><ReceiptText className="h-5 w-5 text-teal-700" /></div>{topMedicines.length ? <div className="space-y-3">{topMedicines.map((item, index) => <div key={item.name} className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">{index + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.name}</span><span className="text-xs text-muted-foreground">{money(item.quantity)} sold</span></span><span className="font-bold">₹{money(item.amount)}</span></div>)}</div> : <div className="rounded-2xl bg-slate-50 py-10 text-center text-sm text-muted-foreground">No sales recorded today</div>}</div>
      <div className="rounded-3xl border bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold">Recent bills</h2><p className="text-sm text-muted-foreground">Latest completed transactions</p></div><button onClick={() => router.push("/sales")} className="text-sm font-semibold text-teal-700">View all</button></div>{data.recentSales.length ? <div className="space-y-2">{data.recentSales.map((sale) => <button key={sale.id} onClick={() => router.push("/sales")} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-slate-50"><span className="rounded-xl bg-teal-50 p-2 text-teal-700"><ReceiptText className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{sale.customers?.name || "Walk-in customer"}</span><span className="text-xs text-muted-foreground">{sale.invoice_number} · {new Date(sale.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span></span><span className="font-bold">₹{money(Number(sale.total_amount))}</span></button>)}</div> : <div className="rounded-2xl bg-slate-50 py-10 text-center text-sm text-muted-foreground">Recent bills will appear here</div>}</div>
    </section>

    <section className="grid gap-3 sm:grid-cols-3">
      {[{ icon: ReceiptText, title: "Create a bill", note: "Fast pharmacy checkout", path: "/sales" }, { icon: Package, title: "Manage medicines", note: "Batches, stock and expiry", path: "/items" }, { icon: Users, title: "Manage staff", note: "Roles and permissions", path: "/staff" }].map((action) => <button key={action.title} onClick={() => router.push(action.path)} className="flex items-center gap-3 rounded-2xl border bg-white p-4 text-left transition hover:border-teal-300"><span className="rounded-xl bg-teal-50 p-2 text-teal-700"><action.icon className="h-5 w-5" /></span><span><span className="block text-sm font-bold">{action.title}</span><span className="text-xs text-muted-foreground">{action.note}</span></span></button>)}
    </section>
    <Dialog open={dayCloseOpen} onOpenChange={setDayCloseOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Close today’s cash</DialogTitle><DialogDescription>Compare the cash expected from completed cash bills with the amount counted in the drawer.</DialogDescription></DialogHeader><div className="space-y-4"><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-muted-foreground">Expected cash</p><p className="mt-1 text-xl font-bold">₹{money(expectedCash)}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-muted-foreground">Difference</p><p className={`mt-1 text-xl font-bold ${Number(countedCash || 0) - expectedCash === 0 ? "text-emerald-700" : "text-amber-700"}`}>₹{money(Number(countedCash || 0) - expectedCash)}</p></div></div><div className="space-y-2"><Label htmlFor="counted-cash">Counted cash *</Label><Input id="counted-cash" type="number" min="0" step="0.01" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} autoFocus /></div><div className="space-y-2"><Label htmlFor="close-notes">Mismatch reason or note</Label><Textarea id="close-notes" value={closeNotes} onChange={(event) => setCloseNotes(event.target.value)} placeholder="Required operational context when cash does not match" /></div><p className="text-xs text-muted-foreground">Expected cash currently includes cash-only bills. Split-payment cash allocation will be added with the new billing workflow.</p></div><DialogFooter><Button variant="outline" onClick={() => setDayCloseOpen(false)}>Cancel</Button><Button onClick={() => void closeDay()} disabled={closingDay}>{closingDay ? "Saving…" : "Save day close"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
