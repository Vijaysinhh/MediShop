-- Safe owner/manager bill cancellation with stock and credit reversal.
-- Apply after 20260921_atomic_pharmacy_billing.sql.

begin;

create or replace function public.cancel_pharmacy_sale(
  p_shop_id uuid,
  p_sale_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_sale public.sales;
  line public.sale_items;
begin
  if auth.uid() is null or not public.can_manage_shop(p_shop_id) then
    raise exception 'Only an owner or manager can cancel a completed bill';
  end if;
  if nullif(trim(p_reason), '') is null then raise exception 'A cancellation reason is required'; end if;

  select * into saved_sale from public.sales
  where id=p_sale_id and shop_id=p_shop_id for update;
  if not found then raise exception 'Bill was not found'; end if;
  if saved_sale.status <> 'completed' then raise exception 'Only a completed bill can be cancelled'; end if;

  for line in select * from public.sale_items where sale_id=p_sale_id and shop_id=p_shop_id loop
    if line.batch_id is not null then
      update public.medicine_batches
      set quantity_available=quantity_available+line.quantity, updated_at=now()
      where id=line.batch_id and shop_id=p_shop_id;
    end if;
    if line.medicine_id is not null then
      insert into public.stock_movements(shop_id,medicine_id,batch_id,movement_type,quantity_change,reference_type,reference_id,reason,created_by)
      values(p_shop_id,line.medicine_id,line.batch_id,'sale_return',line.quantity,'sale',p_sale_id,'Cancelled bill: '||trim(p_reason),auth.uid());
    end if;
  end loop;

  if saved_sale.customer_id is not null and saved_sale.due_amount>0 then
    insert into public.customer_ledger(shop_id,customer_id,sale_id,entry_type,amount,direction,note,created_by)
    values(p_shop_id,saved_sale.customer_id,p_sale_id,'sale_return',saved_sale.due_amount,'credit','Cancelled invoice '||saved_sale.invoice_number,auth.uid());
  end if;

  update public.sales set status='cancelled',notes=concat_ws(E'\n',notes,'Cancellation: '||trim(p_reason)),updated_at=now()
  where id=p_sale_id and shop_id=p_shop_id;
  insert into public.audit_logs(shop_id,actor_id,action,entity_type,entity_id,summary)
  values(p_shop_id,auth.uid(),'cancel_sale','sale',p_sale_id,jsonb_build_object('invoice_number',saved_sale.invoice_number,'reason',trim(p_reason),'restored_total',saved_sale.total_amount));
end;
$$;

revoke all on function public.cancel_pharmacy_sale(uuid,uuid,text) from public;
grant execute on function public.cancel_pharmacy_sale(uuid,uuid,text) to authenticated;

commit;
