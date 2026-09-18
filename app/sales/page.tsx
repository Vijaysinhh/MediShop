"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ban, Barcode, Minus, PauseCircle, Play, Plus, Printer, ReceiptText, Search, ShoppingCart, Stethoscope, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Batch = { id: string; batch_number: string; expiry_date: string | null; mrp: number; selling_price: number; purchase_price: number; quantity_available: number };
type Medicine = { id: string; name: string; generic_name: string | null; strength: string | null; dosage_form: string | null; barcode: string | null; requires_prescription: boolean; schedule_code: string | null; medicine_batches: Batch[] };
type Customer = { id: string; name: string; phone: string | null };
type CartLine = { medicine: Medicine; batch: Batch; quantity: number; discount: number };
type Sale = { id: string; invoice_number: string; status: string; total_amount: number; paid_amount: number; due_amount: number; payment_method: string; created_at: string; customers: { name: string } | null; sale_items: Array<{ medicine_name: string; batch_number: string | null; quantity: number; selling_price: number; line_total: number }> };
type HeldBill = { id: string; label: string; customer_id: string | null; payment_method: string; cart: Array<{ batch_id: string; quantity: number; discount: number }>; receipt_phone: string | null; notes: string | null; created_at: string };
const money = (value: number) => new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);

export default function SalesPage() {
  const { currentShop, user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const searchRef = useRef<HTMLInputElement>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [recent, setRecent] = useState<Sale[]>([]);
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [receiptPhone, setReceiptPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [rxCandidate, setRxCandidate] = useState<{ medicine: Medicine; batch: Batch } | null>(null);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdLabel, setHoldLabel] = useState("");

  const load = useCallback(async () => {
    if (!currentShop?.id) return;
    const [medicineResult, customerResult, salesResult, heldResult] = await Promise.all([
      (supabase as any).from("medicines").select("id,name,generic_name,strength,dosage_form,barcode,requires_prescription,schedule_code,medicine_batches(id,batch_number,expiry_date,mrp,selling_price,purchase_price,quantity_available)").eq("shop_id", currentShop.id).eq("is_active", true).order("name"),
      (supabase as any).from("customers").select("id,name,phone").eq("shop_id", currentShop.id).eq("is_active", true).order("name"),
      (supabase as any).from("sales").select("id,invoice_number,status,total_amount,paid_amount,due_amount,payment_method,created_at,customers(name),sale_items(medicine_name,batch_number,quantity,selling_price,line_total)").eq("shop_id", currentShop.id).order("created_at", { ascending: false }).limit(8),
      (supabase as any).from("held_bills").select("id,label,customer_id,payment_method,cart,receipt_phone,notes,created_at").eq("shop_id", currentShop.id).order("created_at", { ascending: false }),
    ]);
    const error = medicineResult.error || customerResult.error || salesResult.error || heldResult.error;
    if (error) toast.error(error.message); else { setMedicines(medicineResult.data || []); setCustomers(customerResult.data || []); setRecent(salesResult.data || []); setHeldBills(heldResult.data || []); }
  }, [currentShop?.id, supabase]);
  useEffect(() => { void load(); searchRef.current?.focus(); }, [load]);

  const results = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return [];
    return medicines.filter((medicine) => [medicine.name, medicine.generic_name, medicine.strength, medicine.barcode].some((value) => value?.toLowerCase().includes(text))).slice(0, 12);
  }, [medicines, query]);
  const availableBatches = (medicine: Medicine) => medicine.medicine_batches.filter((batch) => Number(batch.quantity_available) > 0 && (!batch.expiry_date || new Date(batch.expiry_date).getTime() >= new Date().setHours(0,0,0,0))).sort((a,b) => (a.expiry_date || "9999").localeCompare(b.expiry_date || "9999"));
  const total = cart.reduce((sum, line) => sum + line.quantity * Number(line.batch.selling_price) - line.discount, 0);
  const due = payment === "credit" ? total : payment === "split" ? Math.max(0, total - Number(paidAmount || 0)) : 0;

  function selectMedicine(medicine: Medicine) {
    const batch = availableBatches(medicine)[0];
    if (!batch) { toast.error("No valid, unexpired stock is available."); return; }
    if (medicine.requires_prescription) { setRxCandidate({ medicine, batch }); return; }
    addLine(medicine, batch);
  }
  function addLine(medicine: Medicine, batch: Batch) {
    setCart((current) => {
      const index = current.findIndex((line) => line.batch.id === batch.id);
      if (index < 0) return [...current, { medicine, batch, quantity: 1, discount: 0 }];
      if (current[index].quantity >= Number(batch.quantity_available)) { toast.error("No more stock is available in this batch."); return current; }
      return current.map((line, position) => position === index ? { ...line, quantity: line.quantity + 1 } : line);
    });
    setQuery(""); searchRef.current?.focus();
  }
  function updateQuantity(index: number, quantity: number) {
    setCart((current) => current.map((line, position) => position === index ? { ...line, quantity: Math.max(0.001, Math.min(quantity, Number(line.batch.quantity_available))) } : line));
  }

  async function completeSale() {
    if (!currentShop?.id || !user?.id || !cart.length) { toast.error("Add at least one medicine."); return; }
    if ((payment === "credit" || payment === "split") && !customerId) { toast.error("Select a customer for credit or split payment."); return; }
    if (payment === "split" && (!Number.isFinite(Number(paidAmount)) || Number(paidAmount) < 0 || Number(paidAmount) > total)) { toast.error("Enter a valid paid amount."); return; }
    setSaving(true);
    const { data: saleId, error } = await (supabase as any).rpc("create_pharmacy_sale", { p_shop_id: currentShop.id, p_customer_id: customerId || null, p_payment_method: payment, p_paid_amount: payment === "split" ? Number(paidAmount) : payment === "credit" ? 0 : total, p_receipt_phone: receiptPhone.trim() || null, p_notes: notes.trim() || null, p_items: cart.map((line) => ({ batch_id: line.batch.id, quantity: line.quantity, discount_amount: line.discount })) });
    if (error) { setSaving(false); toast.error(error.message.includes("create_pharmacy_sale") ? "Apply the atomic pharmacy billing migration in Supabase, then retry." : error.message); return; }
    const { data: completed, error: receiptError } = await (supabase as any).from("sales").select("id,invoice_number,status,total_amount,paid_amount,due_amount,payment_method,created_at,customers(name),sale_items(medicine_name,batch_number,quantity,selling_price,line_total)").eq("id", saleId).single();
    setSaving(false);
    if (receiptError) toast.error(receiptError.message); else setReceipt(completed);
    setCart([]); setCustomerId(""); setReceiptPhone(""); setNotes(""); setPaidAmount(""); setPayment("cash"); toast.success("Bill completed and stock deducted."); await load();
  }

  async function createCustomer() {
    if (!currentShop?.id || customerName.trim().length < 2) { toast.error("Enter the customer name."); return; }
    setSaving(true);
    const { data, error } = await (supabase as any).from("customers").insert({ shop_id: currentShop.id, name: customerName.trim(), phone: customerPhone.trim() || null }).select("id,name,phone").single();
    setSaving(false); if (error) { toast.error(error.message); return; }
    setCustomers((current) => [...current, data].sort((a,b) => a.name.localeCompare(b.name))); setCustomerId(data.id); setReceiptPhone(data.phone || ""); setCustomerName(""); setCustomerPhone(""); setCustomerOpen(false); toast.success("Customer added to this bill.");
  }

  async function cancelSale() {
    if (!currentShop?.id || !receipt || !cancelReason.trim()) { toast.error("Enter a cancellation reason."); return; }
    setSaving(true);
    const { error } = await (supabase as any).rpc("cancel_pharmacy_sale", { p_shop_id: currentShop.id, p_sale_id: receipt.id, p_reason: cancelReason.trim() });
    setSaving(false); if (error) { toast.error(error.message.includes("cancel_pharmacy_sale") ? "Apply the bill cancellation migration in Supabase, then retry." : error.message); return; }
    toast.success("Bill cancelled. Batch stock and customer credit were restored."); setCancelOpen(false); setCancelReason(""); setReceipt(null); await load();
  }

  async function holdBill() {
    if (!currentShop?.id || !user?.id || !cart.length || holdLabel.trim().length < 2) { toast.error("Enter a short customer or token label."); return; }
    setSaving(true);
    const { error } = await (supabase as any).from("held_bills").insert({ shop_id: currentShop.id, label: holdLabel.trim(), customer_id: customerId || null, payment_method: payment, cart: cart.map((line) => ({ batch_id: line.batch.id, quantity: line.quantity, discount: line.discount })), receipt_phone: receiptPhone.trim() || null, notes: notes.trim() || null, created_by: user.id });
    setSaving(false); if (error) { toast.error(error.message.includes("held_bills") ? "Apply the held bills migration in Supabase, then retry." : error.message); return; }
    setCart([]); setCustomerId(""); setPayment("cash"); setReceiptPhone(""); setNotes(""); setPaidAmount(""); setHoldLabel(""); setHoldOpen(false); toast.success("Bill held for later."); await load();
  }

  async function resumeBill(held: HeldBill) {
    const restored: CartLine[] = [];
    for (const saved of held.cart) {
      const medicine = medicines.find((entry) => entry.medicine_batches.some((batch) => batch.id === saved.batch_id));
      const batch = medicine?.medicine_batches.find((entry) => entry.id === saved.batch_id);
      if (!medicine || !batch || !availableBatches(medicine).some((entry) => entry.id === batch.id) || Number(batch.quantity_available) < Number(saved.quantity)) continue;
      restored.push({ medicine, batch, quantity: Number(saved.quantity), discount: Number(saved.discount || 0) });
    }
    if (!restored.length) { toast.error("This held bill no longer has valid stock to resume."); return; }
    const { error } = await (supabase as any).from("held_bills").delete().eq("id", held.id).eq("shop_id", currentShop?.id);
    if (error) { toast.error(error.message); return; }
    setCart(restored); setCustomerId(held.customer_id || ""); setPayment(held.payment_method); setReceiptPhone(held.receipt_phone || ""); setNotes(held.notes || ""); setHeldBills((current) => current.filter((entry) => entry.id !== held.id));
    if (restored.length < held.cart.length) toast.warning("Some unavailable or expired lines were removed while resuming."); else toast.success("Held bill resumed.");
  }

  return <div className="mx-auto max-w-7xl space-y-5 pb-24 pt-3 sm:pb-10">
    <section className="rounded-3xl bg-gradient-to-br from-slate-950 to-teal-800 p-5 text-white shadow-xl"><div className="flex items-center justify-between gap-4"><div><p className="text-sm text-teal-100">Counter billing</p><h1 className="text-3xl font-bold">New pharmacy bill</h1><p className="mt-1 text-sm text-slate-200">Search, scan, bill and move to the next customer.</p></div><span className="rounded-2xl bg-amber-400 p-3 text-slate-950"><ReceiptText className="h-6 w-6" /></span></div></section>
    <div className="grid gap-5 xl:grid-cols-[1fr_430px]">
      <section className="space-y-4"><div className="rounded-3xl border bg-white p-4 shadow-sm"><Label htmlFor="medicine-search">Medicine or barcode</Label><div className="relative mt-2"><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input ref={searchRef} id="medicine-search" className="h-12 pl-10 pr-11 text-base" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type medicine, generic, strength or scan barcode" /><Barcode className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-700" /></div>{query && <div className="mt-3 max-h-[430px] divide-y overflow-y-auto rounded-2xl border">{results.length ? results.map((medicine) => { const batches = availableBatches(medicine); const batch = batches[0]; return <button key={medicine.id} onClick={() => selectMedicine(medicine)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-teal-50"><span className="rounded-xl bg-teal-50 p-2 text-teal-700"><PackageIcon /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-semibold">{medicine.name}{medicine.requires_prescription && <Stethoscope className="h-4 w-4 text-rose-600" />}</span><span className="block truncate text-xs text-muted-foreground">{[medicine.generic_name,medicine.strength,medicine.dosage_form].filter(Boolean).join(" · ") || "Details not recorded"}</span>{batch && <span className="mt-1 block text-xs text-teal-700">FEFO: {batch.batch_number} · exp {batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString("en-IN") : "not set"}</span>}</span><span className="text-right"><span className="block font-bold">{batch ? `₹${money(batch.selling_price)}` : "No stock"}</span><span className="text-xs text-muted-foreground">{batches.reduce((sum,b) => sum+Number(b.quantity_available),0)} available</span></span></button>; }) : <p className="p-8 text-center text-sm text-muted-foreground">No matching medicine</p>}</div>}</div>
        {heldBills.length > 0 && <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-bold text-amber-950">Held bills</h2><p className="text-xs text-amber-800">Resume after confirming stock is still available.</p></div><span className="rounded-full bg-amber-200 px-2.5 py-1 text-xs font-bold text-amber-900">{heldBills.length}</span></div><div className="mt-3 space-y-2">{heldBills.map((held) => <div key={held.id} className="flex items-center gap-3 rounded-xl bg-white p-3"><PauseCircle className="h-5 w-5 text-amber-700" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{held.label}</span><span className="text-xs text-muted-foreground">{held.cart.length} lines · {new Date(held.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span></span><Button size="sm" onClick={() => void resumeBill(held)}><Play className="mr-1 h-3.5 w-3.5" />Resume</Button></div>)}</div></div>}
        <div className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="font-bold">Recent bills</h2><div className="mt-3 space-y-2">{recent.length ? recent.map((sale) => <button key={sale.id} onClick={() => setReceipt(sale)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-slate-50"><span className="rounded-xl bg-slate-100 p-2"><ReceiptText className="h-4 w-4" /></span><span className="flex-1"><span className="block text-sm font-semibold">{sale.invoice_number}</span><span className="text-xs text-muted-foreground">{sale.customers?.name || "Walk-in"} · {new Date(sale.created_at).toLocaleString("en-IN")}</span></span><span className="font-bold">₹{money(sale.total_amount)}</span></button>) : <p className="py-8 text-center text-sm text-muted-foreground">No bills yet</p>}</div></div>
      </section>
      <aside className="h-fit rounded-3xl border bg-white shadow-sm xl:sticky xl:top-24"><div className="flex items-center justify-between border-b p-4"><h2 className="flex items-center gap-2 font-bold"><ShoppingCart className="h-5 w-5 text-teal-700" />Current bill</h2><span className="text-sm text-muted-foreground">{cart.length} lines</span></div><div className="max-h-[400px] divide-y overflow-y-auto">{cart.length ? cart.map((line,index) => <div key={line.batch.id} className="p-4"><div className="flex gap-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{line.medicine.name}</p><p className="text-xs text-muted-foreground">Batch {line.batch.batch_number} · ₹{money(line.batch.selling_price)}</p></div><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setCart((current) => current.filter((_,position) => position !== index))}><Trash2 className="h-4 w-4" /></Button></div><div className="mt-3 flex items-center justify-between"><div className="flex items-center rounded-xl border"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(index,line.quantity-1)}><Minus className="h-3 w-3" /></Button><Input className="h-8 w-16 border-0 text-center" type="number" min="0.001" max={line.batch.quantity_available} step="0.001" value={line.quantity} onChange={(e) => updateQuantity(index,Number(e.target.value))} /><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(index,line.quantity+1)}><Plus className="h-3 w-3" /></Button></div><span className="font-bold">₹{money(line.quantity*Number(line.batch.selling_price)-line.discount)}</span></div><div className="mt-2 flex items-center justify-end gap-2"><Label className="text-xs text-muted-foreground">Discount ₹</Label><Input className="h-8 w-24 text-right" type="number" min="0" max={line.quantity*Number(line.batch.selling_price)} step="0.01" value={line.discount} onChange={(e) => setCart((current) => current.map((item,position) => position===index ? { ...item, discount: Math.max(0, Math.min(Number(e.target.value)||0, item.quantity*Number(item.batch.selling_price))) } : item))} /></div></div>) : <div className="p-10 text-center"><ShoppingCart className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium">Search a medicine to begin</p></div>}</div>
        <div className="space-y-4 border-t p-4"><div className="flex items-center justify-between text-xl font-bold"><span>Total</span><span>₹{money(total)}</span></div><div className="grid grid-cols-5 gap-1">{["cash","upi","card","credit","split"].map((method) => <button key={method} onClick={() => setPayment(method)} className={`rounded-lg px-1 py-2 text-xs font-semibold capitalize ${payment===method ? "bg-teal-700 text-white" : "bg-slate-100"}`}>{method}</button>)}</div><Field label={payment==="credit"||payment==="split" ? "Customer *" : "Customer (optional)"}><div className="flex gap-2"><select className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" value={customerId} onChange={(e) => { setCustomerId(e.target.value); const selected=customers.find((customer)=>customer.id===e.target.value); if(selected?.phone) setReceiptPhone(selected.phone); }}><option value="">Walk-in customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}</select><Button variant="outline" size="icon" title="Add customer" onClick={() => setCustomerOpen(true)}><UserPlus className="h-4 w-4" /></Button></div></Field>{payment==="split" && <Field label="Amount paid now"><Input type="number" min="0" max={total} step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} /><p className="text-xs text-amber-700">Due: ₹{money(due)}</p></Field>}<div className="grid grid-cols-2 gap-3"><Field label="Receipt phone"><Input inputMode="tel" value={receiptPhone} onChange={(e) => setReceiptPhone(e.target.value)} /></Field><Field label="Bill note"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div><div className="grid grid-cols-[auto_1fr] gap-2"><Button variant="outline" className="h-12" disabled={saving||!cart.length} onClick={() => setHoldOpen(true)}><PauseCircle className="mr-2 h-4 w-4" />Hold</Button><Button className="h-12 bg-teal-700 text-base hover:bg-teal-800" disabled={saving||!cart.length} onClick={() => void completeSale()}>{saving ? "Completing bill…" : `Complete bill · ₹${money(total)}`}</Button></div></div>
      </aside>
    </div>
    <Dialog open={!!rxCandidate} onOpenChange={(open) => !open && setRxCandidate(null)}><DialogContent><DialogHeader><DialogTitle>Prescription confirmation</DialogTitle><DialogDescription>{rxCandidate?.medicine.name} is marked as a prescription medicine{rxCandidate?.medicine.schedule_code ? ` under Schedule ${rxCandidate.medicine.schedule_code}` : ""}.</DialogDescription></DialogHeader><div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-900">Confirm that the required valid prescription has been reviewed before adding this medicine to the bill.</div><DialogFooter><Button variant="outline" onClick={() => setRxCandidate(null)}>Cancel</Button><Button onClick={() => { if (rxCandidate) addLine(rxCandidate.medicine,rxCandidate.batch); setRxCandidate(null); }}>Prescription reviewed</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={customerOpen} onOpenChange={setCustomerOpen}><DialogContent><DialogHeader><DialogTitle>Quick add customer</DialogTitle><DialogDescription>Create a customer without leaving the current bill.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Customer name *"><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} autoFocus /></Field><Field label="Phone"><Input inputMode="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></Field></div><DialogFooter><Button variant="outline" onClick={() => setCustomerOpen(false)}>Cancel</Button><Button onClick={() => void createCustomer()} disabled={saving}>{saving ? "Adding…" : "Add customer"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={holdOpen} onOpenChange={setHoldOpen}><DialogContent><DialogHeader><DialogTitle>Hold current bill</DialogTitle><DialogDescription>Save this cart while serving another customer. Stock is checked again when the bill is resumed and completed.</DialogDescription></DialogHeader><Field label="Customer name or token *"><Input value={holdLabel} onChange={(e) => setHoldLabel(e.target.value)} placeholder="e.g. Token 12 or Mr Sharma" autoFocus /></Field><DialogFooter><Button variant="outline" onClick={() => setHoldOpen(false)}>Cancel</Button><Button onClick={() => void holdBill()} disabled={saving}>{saving ? "Holding…" : "Hold bill"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!receipt} onOpenChange={(open) => !open && setReceipt(null)}><DialogContent className="sm:max-w-md"><div id="thermal-receipt"><DialogHeader><DialogTitle>{currentShop?.name}</DialogTitle><DialogDescription>Receipt {receipt?.invoice_number}<br />{receipt && new Date(receipt.created_at).toLocaleString("en-IN")} · {receipt?.customers?.name || "Walk-in customer"}</DialogDescription></DialogHeader>{receipt?.status === "cancelled" && <div className="my-3 rounded-xl bg-red-50 p-3 text-center text-sm font-bold text-red-700">CANCELLED</div>}<div className="my-4 divide-y rounded-2xl border">{receipt?.sale_items.map((line,index) => <div key={index} className="flex justify-between gap-3 p-3 text-sm"><span><span className="block font-medium">{line.medicine_name}</span><span className="text-xs text-muted-foreground">{line.quantity} × ₹{money(line.selling_price)} · Batch {line.batch_number}</span></span><span className="font-bold">₹{money(line.line_total)}</span></div>)}</div><div className="space-y-1 text-sm"><div className="flex justify-between text-lg font-bold"><span>Total</span><span>₹{money(receipt?.total_amount || 0)}</span></div>{Number(receipt?.due_amount)>0 && <div className="flex justify-between text-amber-700"><span>Amount due</span><span>₹{money(receipt?.due_amount || 0)}</span></div>}<p className="capitalize text-muted-foreground">Paid via {receipt?.payment_method}</p></div></div><DialogFooter className="print:hidden">{receipt?.status === "completed" && ["owner","manager"].includes(user?.role || "") && <Button variant="destructive" onClick={() => setCancelOpen(true)}><Ban className="mr-2 h-4 w-4" />Cancel bill</Button>}<Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button><Button onClick={() => setReceipt(null)}>Next bill</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={cancelOpen} onOpenChange={setCancelOpen}><DialogContent><DialogHeader><DialogTitle>Cancel completed bill?</DialogTitle><DialogDescription>This restores every sold batch quantity and reverses the customer’s credit balance. The audit record remains.</DialogDescription></DialogHeader><Field label="Cancellation reason *"><Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Wrong medicine, duplicate bill, billing error…" /></Field><DialogFooter><Button variant="outline" onClick={() => setCancelOpen(false)}>Keep bill</Button><Button variant="destructive" onClick={() => void cancelSale()} disabled={saving}>{saving ? "Cancelling…" : "Cancel and restore stock"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function PackageIcon() { return <ShoppingCart className="h-4 w-4" />; }
