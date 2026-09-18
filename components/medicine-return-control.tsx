"use client";

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatMoney } from '@/lib/number-format';
import { FileOutput } from 'lucide-react';
import { toast } from 'sonner';

export function MedicineReturnControl({ item, onReturned }: { item: any; onReturned?: () => void }) {
  const { user, currentShopId } = useAuth();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [returns, setReturns] = useState<any[]>([]);
  const [credit, setCredit] = useState<Record<number,string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const requestId = useRef<string | null>(null);
  const supabase = createClient();
  const load = async () => {
    setReady(false);
    const { data, error } = await (supabase as any).from('medicine_returns')
      .select('id,quantity,expected_credit,received_credit,status,created_at,supplier_name')
      .eq('shop_id', currentShopId).eq('item_id',item.id).order('created_at',{ascending:false});
    if (error) { setError('Return tracking needs pharmacy setup and an online connection.'); return; }
    setReturns(data || []); setReady(true); setError('');
  };
  useEffect(() => { if (open && currentShopId) void load(); }, [open,currentShopId,item.id]);
  if (user?.role !== 'owner' || !currentShopId || item.id <= 0) return null;

  const sendReturn = async () => {
    const amount=Number(quantity);
    if (!quantity.trim() || !Number.isFinite(amount) || amount<=0 || amount>Number(item.quantity)) { setError('Enter a return quantity within available stock.'); return; }
    if (!item.supplierName?.trim()) { setError('Add a supplier to this medicine before returning stock.'); return; }
    if (!navigator.onLine) { setError('Connect to the internet before sending a stock return.'); return; }
    setBusy(true); setError('');
    requestId.current ||= crypto.randomUUID();
    try {
      const {error}=await (supabase as any).rpc('send_pharmacy_return', {p_shop_id:currentShopId,p_item_id:item.id,p_quantity:amount,p_user_id:user.id,p_request_id:requestId.current});
      if(error) throw error;
      requestId.current=null; setQuantity('');
      window.dispatchEvent(new Event('refresh-dukan-data')); onReturned?.();
      toast.success('Stock sent for return; supplier credit is pending.');
      await load();
    } catch(e:any){setError(e.message || 'Return could not be saved. Retry to check the same return request.');}
    finally {setBusy(false);}
  };
  const saveCredit=async (id:number)=>{
    const value=credit[id]; const amount=Number(value);
    if (!value?.trim() || !Number.isFinite(amount) || amount<0){setError('Enter the credit amount actually received, including zero if applicable.');return;}
    setBusy(true);setError('');
    try {
      const {error}=await (supabase as any).rpc('credit_pharmacy_return',{p_shop_id:currentShopId,p_return_id:id,p_received_credit:amount,p_user_id:user.id});
      if(error)throw error;
      toast.success('Supplier credit recorded');await load();window.dispatchEvent(new Event('refresh-dukan-data'));
    }catch(e:any){setError(e.message || 'Supplier credit could not be saved');}finally{setBusy(false);}
  };
  return <>
    <Button variant="outline" size="sm" className="gap-1.5 text-stone-700" onClick={()=>setOpen(true)}><FileOutput className="h-4 w-4"/>Supplier return</Button>
    <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Return {item.name || 'medicine'} to supplier</DialogTitle><DialogDescription>Sending a return removes the quantity from saleable stock. Supplier credit stays pending until you record the amount received.</DialogDescription></DialogHeader>
      <div className="rounded-xl bg-stone-50 p-3 text-sm"><p>Supplier: {item.supplierName || 'Not set'}</p><p>Available stock: {item.quantity}{item.batchNumber ? ` · Batch ${item.batchNumber}` : ''}</p></div>
      <label className="space-y-1 text-sm font-medium">Quantity to send<Input value={quantity} type="number" min="0" step="any" max={Number(item.quantity)} disabled={busy || !!requestId.current} onChange={e=>setQuantity(e.target.value)} placeholder="Enter quantity"/></label>
      <p className="text-xs text-stone-500">Expected supplier credit at purchase cost: ₹{formatMoney((Number(quantity)||0)*Number(item.buyPrice||0))}</p>
      {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
      <Button disabled={busy || !ready || !quantity.trim()} onClick={sendReturn} className="bg-teal-700 hover:bg-teal-800">{busy?'Saving…':requestId.current?'Retry this return':'Confirm stock sent'}</Button>
      <div className="space-y-3 border-t pt-3"><h3 className="font-semibold">Return history</h3>{!returns.length && <p className="text-sm text-stone-500">No recorded returns.</p>}{returns.map(row=><div key={row.id} className="space-y-2 rounded-xl border p-3 text-sm">
        <p className="font-medium">{row.quantity} returned · {row.status==='credited'?'Credit received':'Credit pending'}</p><p className="text-xs text-stone-500">{new Date(row.created_at).toLocaleDateString('en-IN')} · Expected ₹{formatMoney(row.expected_credit)}</p>
        {row.status==='credited'?<p className="text-teal-700">Received ₹{formatMoney(row.received_credit)}</p>:<div className="flex gap-2"><Input aria-label={`Credit received for return ${row.id}`} value={credit[row.id]||''} onChange={e=>setCredit({...credit,[row.id]:e.target.value})} type="number" min="0" step="0.01" placeholder="Credit received (₹)" disabled={busy}/><Button size="sm" disabled={busy} onClick={()=>saveCredit(row.id)}>Record credit</Button></div>}
      </div>)}</div>
    </DialogContent></Dialog>
  </>;
}
