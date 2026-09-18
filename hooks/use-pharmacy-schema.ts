"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { medicineFields, refillFields } from '@/lib/pharmacy-fields';

const columns = {
  items: Object.values(medicineFields).join(','),
  credit_customers: Object.values(refillFields).join(','),
  sales: 'receipt_phone',
  sale_items: 'gst_rate,generic_name,strength,dosage_form',
} as const;
type Table = keyof typeof columns;
type Status = { ready: boolean; error: string | null };
const pending = new Map<string, Promise<Status>>();

export function usePharmacySchema(table: Table, shopId?: string | number) {
  const [status, setStatus] = useState<Status>({ ready: false, error: null });
  useEffect(() => {
    if (!shopId) { setStatus({ ready: false, error: null }); return; }
    let active = true;
    const key = `${process.env.NEXT_PUBLIC_SUPABASE_URL}:${table}:${shopId}`;
    const check = (refresh = false) => {
      if (refresh) pending.delete(key);
      if (!pending.has(key)) pending.set(key, (async () => {
        try {
          const { error } = await (createClient() as any).from(table).select(columns[table]).eq('shop_id', shopId).limit(0).abortSignal(AbortSignal.timeout(10000));
          return error ? { ready: false, error: 'Pharmacy setup is required or the database is unavailable.' } : { ready: true, error: null };
        } catch { return { ready: false, error: 'Unable to check pharmacy setup. Reconnect and reload.' }; }
      })());
      void pending.get(key)!.then(result => { if (active) setStatus(result); });
    };
    setStatus({ ready: false, error: null });
    check();
    const retry = () => check(true);
    window.addEventListener('online', retry);
    window.addEventListener('pharmacy-schema-refresh', retry);
    return () => { active = false; window.removeEventListener('online', retry); window.removeEventListener('pharmacy-schema-refresh', retry); };
  }, [table, shopId]);
  return { pharmacySchemaReady: status.ready, pharmacySchemaError: status.error };
}
