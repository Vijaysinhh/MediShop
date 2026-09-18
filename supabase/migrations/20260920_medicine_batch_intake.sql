-- Atomic medicine batch intake for the clean MediShop inventory screen.
-- Apply after medishop-clean-schema.sql.

begin;

create or replace function public.receive_medicine_batch(
  p_shop_id uuid,
  p_medicine_id uuid,
  p_supplier_id uuid,
  p_batch_number text,
  p_expiry_date date,
  p_mrp numeric,
  p_purchase_price numeric,
  p_selling_price numeric,
  p_quantity numeric
)
returns public.medicine_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.medicine_batches;
begin
  if auth.uid() is null or not public.can_manage_shop(p_shop_id) then
    raise exception 'Only an owner or manager can receive pharmacy stock';
  end if;
  if not exists (select 1 from public.medicines where id = p_medicine_id and shop_id = p_shop_id and is_active) then
    raise exception 'Medicine was not found in this pharmacy';
  end if;
  if p_supplier_id is not null and not exists (select 1 from public.suppliers where id = p_supplier_id and shop_id = p_shop_id and is_active) then
    raise exception 'Supplier was not found in this pharmacy';
  end if;
  if nullif(trim(p_batch_number), '') is null or p_expiry_date is null then
    raise exception 'Batch number and expiry date are required';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_mrp < 0 or p_purchase_price < 0 or p_selling_price < 0 then
    raise exception 'Quantity and prices are invalid';
  end if;
  if p_selling_price > p_mrp then
    raise exception 'Selling price cannot exceed MRP';
  end if;

  insert into public.medicine_batches (
    shop_id, medicine_id, supplier_id, batch_number, expiry_date,
    mrp, purchase_price, selling_price, quantity_received, quantity_available
  ) values (
    p_shop_id, p_medicine_id, p_supplier_id, trim(p_batch_number), p_expiry_date,
    round(p_mrp, 2), round(p_purchase_price, 2), round(p_selling_price, 2), p_quantity, p_quantity
  )
  on conflict (shop_id, medicine_id, batch_number, expiry_date)
  do update set
    supplier_id = coalesce(excluded.supplier_id, medicine_batches.supplier_id),
    mrp = excluded.mrp,
    purchase_price = excluded.purchase_price,
    selling_price = excluded.selling_price,
    quantity_received = medicine_batches.quantity_received + excluded.quantity_received,
    quantity_available = medicine_batches.quantity_available + excluded.quantity_available,
    updated_at = now()
  returning * into saved;

  insert into public.stock_movements (
    shop_id, medicine_id, batch_id, movement_type, quantity_change,
    reference_type, reference_id, reason, created_by
  ) values (
    p_shop_id, p_medicine_id, saved.id, 'purchase', p_quantity,
    'batch_intake', saved.id, 'Medicine batch received', auth.uid()
  );

  insert into public.audit_logs (shop_id, actor_id, action, entity_type, entity_id, summary)
  values (p_shop_id, auth.uid(), 'receive_batch', 'medicine_batch', saved.id,
    jsonb_build_object('medicine_id', p_medicine_id, 'batch_number', saved.batch_number, 'quantity', p_quantity));

  return saved;
end;
$$;

revoke all on function public.receive_medicine_batch(uuid,uuid,uuid,text,date,numeric,numeric,numeric,numeric) from public;
grant execute on function public.receive_medicine_batch(uuid,uuid,uuid,text,date,numeric,numeric,numeric,numeric) to authenticated;

commit;
