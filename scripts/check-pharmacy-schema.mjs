import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

nextEnv.loadEnvConfig(process.cwd(), true);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Supabase environment is incomplete');
if (new URL(url).hostname !== 'pvdfjhpafucuzmvaxnde.supabase.co') {
  throw new Error('This check is restricted to the MediShop development project');
}
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const checks = {
  items: 'id,catalog_code,generic_name,strength,dosage_form,pack_type,shelf_location,batch_number,gst_rate,requires_prescription,cold_storage,supplier_name,supplier_phone',
  credit_customers: 'id,repeat_medicine,repeat_every_days,last_purchase_date',
  sales: 'id,receipt_phone',
  sale_items: 'id,generic_name,strength,dosage_form,gst_rate',
  cash_reconciliations: 'id,shop_id,date,expected_amount,counted_amount,difference,user_id',
  medicine_returns: 'id,shop_id,item_id,quantity,expected_credit,received_credit,status',
};
let failed = 0;
for (const [table, columns] of Object.entries(checks)) {
  const { error } = await client.from(table).select(columns).limit(0).abortSignal(AbortSignal.timeout(15000));
  if (error) { failed++; console.log(`MISSING ${table}: ${error.message}`); }
  else console.log(`OK ${table}`);
}
console.log(failed ? `Pharmacy migration required (${failed} checks).` : 'Pharmacy columns are available.');
process.exitCode = failed ? 1 : 0;
