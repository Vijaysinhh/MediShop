-- Atomic stock adjustment and supplier-return actions for Inventory.
-- Apply after medishop-clean-schema.sql.

begin;

create or replace function public.adjust_medicine_batch(
  p_shop_id uuid, p_batch_id uuid, p_quantity_change numeric,
  p_movement_type public.movement_type, p_reason text
)
returns public.medicine_batches
language plpgsql security definer set search_path=public as $$
declare saved public.medicine_batches;
begin
  if auth.uid() is null or not public.can_manage_shop(p_shop_id) then raise exception 'Only an owner or manager can adjust stock'; end if;
  if p_quantity_change is null or p_quantity_change=0 then raise exception 'Enter a non-zero quantity change'; end if;
  if p_movement_type not in ('adjustment','damage','expiry') then raise exception 'Unsupported stock adjustment type'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'A reason is required'; end if;
  select * into saved from public.medicine_batches where id=p_batch_id and shop_id=p_shop_id for update;
  if not found then raise exception 'Batch was not found'; end if;
  if saved.quantity_available+p_quantity_change<0 then raise exception 'Adjustment exceeds available batch stock'; end if;
  update public.medicine_batches set quantity_available=quantity_available+p_quantity_change,updated_at=now() where id=saved.id returning * into saved;
  insert into public.stock_movements(shop_id,medicine_id,batch_id,movement_type,quantity_change,reference_type,reference_id,reason,created_by)
  values(p_shop_id,saved.medicine_id,saved.id,p_movement_type,p_quantity_change,'batch_adjustment',saved.id,trim(p_reason),auth.uid());
  insert into public.audit_logs(shop_id,actor_id,action,entity_type,entity_id,summary)
  values(p_shop_id,auth.uid(),'adjust_stock','medicine_batch',saved.id,jsonb_build_object('type',p_movement_type,'quantity_change',p_quantity_change,'reason',trim(p_reason)));
  return saved;
end $$;

create or replace function public.send_batch_to_supplier(
  p_shop_id uuid, p_batch_id uuid, p_quantity numeric, p_reason text
)
returns public.supplier_returns
language plpgsql security definer set search_path=public as $$
declare batch public.medicine_batches; saved public.supplier_returns;
begin
  if auth.uid() is null or not public.can_manage_shop(p_shop_id) then raise exception 'Only an owner or manager can return supplier stock'; end if;
  if p_quantity is null or p_quantity<=0 then raise exception 'Enter a positive return quantity'; end if;
  select * into batch from public.medicine_batches where id=p_batch_id and shop_id=p_shop_id for update;
  if not found then raise exception 'Batch was not found'; end if;
  if batch.supplier_id is null then raise exception 'Assign a supplier to this batch before returning it'; end if;
  if batch.quantity_available<p_quantity then raise exception 'Return quantity exceeds available batch stock'; end if;
  update public.medicine_batches set quantity_available=quantity_available-p_quantity,updated_at=now() where id=batch.id;
  insert into public.supplier_returns(shop_id,supplier_id,medicine_id,batch_id,quantity,expected_credit,status,reason,created_by)
  values(p_shop_id,batch.supplier_id,batch.medicine_id,batch.id,p_quantity,round(p_quantity*batch.purchase_price,2),'sent',nullif(trim(p_reason),''),auth.uid()) returning * into saved;
  insert into public.stock_movements(shop_id,medicine_id,batch_id,movement_type,quantity_change,reference_type,reference_id,reason,created_by)
  values(p_shop_id,batch.medicine_id,batch.id,'supplier_return',-p_quantity,'supplier_return',saved.id,coalesce(nullif(trim(p_reason),''),'Returned to supplier'),auth.uid());
  insert into public.audit_logs(shop_id,actor_id,action,entity_type,entity_id,summary)
  values(p_shop_id,auth.uid(),'send_supplier_return','supplier_return',saved.id,jsonb_build_object('batch_id',batch.id,'quantity',p_quantity,'expected_credit',saved.expected_credit));
  return saved;
end $$;

revoke all on function public.adjust_medicine_batch(uuid,uuid,numeric,public.movement_type,text), public.send_batch_to_supplier(uuid,uuid,numeric,text) from public;
grant execute on function public.adjust_medicine_batch(uuid,uuid,numeric,public.movement_type,text), public.send_batch_to_supplier(uuid,uuid,numeric,text) to authenticated;

commit;
