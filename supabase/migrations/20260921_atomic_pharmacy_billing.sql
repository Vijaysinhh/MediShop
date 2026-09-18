-- Atomic FEFO-ready pharmacy billing for the clean MediShop schema.
-- Apply after medishop-clean-schema.sql.

begin;

create or replace function public.create_pharmacy_sale(
  p_shop_id uuid,
  p_customer_id uuid,
  p_payment_method public.payment_method,
  p_paid_amount numeric,
  p_receipt_phone text,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  line jsonb;
  batch public.medicine_batches;
  medicine public.medicines;
  sale_id uuid := gen_random_uuid();
  invoice text;
  qty numeric;
  discount numeric;
  line_total numeric;
  subtotal numeric := 0;
  tax_total numeric := 0;
  paid numeric;
  due numeric;
begin
  if actor is null or not public.has_shop_access(p_shop_id) then raise exception 'You do not have access to this pharmacy'; end if;
  if not exists (select 1 from public.shops where id=p_shop_id and status='active') then raise exception 'This pharmacy is not active'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'Add at least one medicine'; end if;
  if p_customer_id is not null and not exists(select 1 from public.customers where id=p_customer_id and shop_id=p_shop_id and is_active) then raise exception 'Customer was not found'; end if;

  invoice := coalesce((select invoice_prefix from public.shop_settings where shop_id=p_shop_id),'MS') || '-' || to_char(clock_timestamp(),'YYYYMMDD-HH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));

  -- Lock and validate every selected batch before writing any sale records.
  for line in select value from jsonb_array_elements(p_items) loop
    qty := (line->>'quantity')::numeric;
    discount := coalesce((line->>'discount_amount')::numeric,0);
    if qty is null or qty<=0 or discount<0 then raise exception 'Sale quantity or discount is invalid'; end if;
    select * into batch from public.medicine_batches where id=(line->>'batch_id')::uuid and shop_id=p_shop_id for update;
    if not found then raise exception 'A selected medicine batch was not found'; end if;
    if batch.expiry_date is not null and batch.expiry_date < current_date then raise exception 'Expired batch % cannot be sold', batch.batch_number; end if;
    if batch.quantity_available < qty then raise exception 'Insufficient stock in batch %', batch.batch_number; end if;
    select * into medicine from public.medicines where id=batch.medicine_id and shop_id=p_shop_id and is_active;
    if not found then raise exception 'A selected medicine is inactive or missing'; end if;
    line_total := round(qty*batch.selling_price-discount,2);
    if line_total<0 then raise exception 'Discount cannot exceed the line value'; end if;
    subtotal := subtotal+line_total;
    tax_total := tax_total + case when medicine.gst_rate>0 then round(line_total*medicine.gst_rate/(100+medicine.gst_rate),2) else 0 end;
  end loop;

  paid := case when p_payment_method='credit' then 0 when p_payment_method='split' then coalesce(p_paid_amount,0) else subtotal end;
  if paid<0 or paid>subtotal then raise exception 'Paid amount must be between zero and the bill total'; end if;
  due := subtotal-paid;
  if due>0 and p_customer_id is null then raise exception 'Select a customer for credit or split payment'; end if;

  insert into public.sales(id,shop_id,invoice_number,customer_id,status,payment_method,subtotal,tax_amount,discount_amount,paid_amount,due_amount,total_amount,receipt_phone,notes,sold_by)
  values(sale_id,p_shop_id,invoice,p_customer_id,'completed',p_payment_method,subtotal,tax_total,0,paid,due,subtotal,nullif(trim(p_receipt_phone),''),nullif(trim(p_notes),''),actor);

  for line in select value from jsonb_array_elements(p_items) loop
    qty := (line->>'quantity')::numeric;
    discount := coalesce((line->>'discount_amount')::numeric,0);
    select * into batch from public.medicine_batches where id=(line->>'batch_id')::uuid and shop_id=p_shop_id;
    select * into medicine from public.medicines where id=batch.medicine_id;
    line_total := round(qty*batch.selling_price-discount,2);
    insert into public.sale_items(sale_id,shop_id,medicine_id,batch_id,medicine_name,batch_number,quantity,mrp,selling_price,purchase_price,gst_rate,discount_amount,line_total)
    values(sale_id,p_shop_id,medicine.id,batch.id,medicine.name,batch.batch_number,qty,batch.mrp,batch.selling_price,batch.purchase_price,medicine.gst_rate,discount,line_total);
    update public.medicine_batches set quantity_available=quantity_available-qty,updated_at=now() where id=batch.id;
    insert into public.stock_movements(shop_id,medicine_id,batch_id,movement_type,quantity_change,reference_type,reference_id,reason,created_by)
    values(p_shop_id,medicine.id,batch.id,'sale',-qty,'sale',sale_id,'Pharmacy sale '||invoice,actor);
  end loop;

  if due>0 then
    insert into public.customer_ledger(shop_id,customer_id,sale_id,entry_type,amount,direction,note,created_by)
    values(p_shop_id,p_customer_id,sale_id,'credit_sale',due,'debit','Credit from invoice '||invoice,actor);
  end if;
  insert into public.audit_logs(shop_id,actor_id,action,entity_type,entity_id,summary)
  values(p_shop_id,actor,'create_sale','sale',sale_id,jsonb_build_object('invoice_number',invoice,'total_amount',subtotal,'payment_method',p_payment_method));
  return sale_id;
end;
$$;

revoke all on function public.create_pharmacy_sale(uuid,uuid,public.payment_method,numeric,text,text,jsonb) from public;
grant execute on function public.create_pharmacy_sale(uuid,uuid,public.payment_method,numeric,text,text,jsonb) to authenticated;

commit;
