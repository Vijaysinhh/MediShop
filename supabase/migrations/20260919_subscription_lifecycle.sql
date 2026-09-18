-- Atomic subscription approval and expiry synchronization.
-- Apply after the 20260918 subscription migrations.

begin;

create or replace function public.review_subscription_payment(
  p_request_id uuid,
  p_decision text,
  p_plan_code text default null,
  p_billing_period text default null,
  p_custom_ends_at timestamptz default null,
  p_rejection_reason text default null
)
returns public.subscription_payment_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  payment public.subscription_payment_requests;
  pharmacy public.shops;
  starts_at_value timestamptz;
  ends_at_value timestamptz;
  subscription_id_value uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform administrator can review subscription payments';
  end if;

  if p_decision not in ('verified', 'rejected') then
    raise exception 'Decision must be verified or rejected';
  end if;

  select * into payment
  from public.subscription_payment_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'Payment request was not found'; end if;
  if payment.status <> 'submitted' then raise exception 'Payment request has already been reviewed'; end if;

  if p_decision = 'rejected' then
    update public.subscription_payment_requests
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
        rejection_reason = nullif(trim(p_rejection_reason), '')
    where id = payment.id returning * into payment;
    return payment;
  end if;

  if coalesce(p_billing_period, '') not in ('monthly', 'yearly', 'custom') then
    raise exception 'Choose monthly, yearly, or custom billing';
  end if;

  select * into pharmacy from public.shops where id = payment.shop_id for update;
  if not found then raise exception 'Medical shop was not found'; end if;

  starts_at_value := greatest(coalesce(pharmacy.subscription_ends_at, now()), now());
  ends_at_value := case
    when p_custom_ends_at is not null then p_custom_ends_at
    when p_billing_period = 'monthly' then starts_at_value + interval '1 month'
    when p_billing_period = 'yearly' then starts_at_value + interval '1 year'
    else null
  end;

  if ends_at_value is null or ends_at_value <= starts_at_value then
    raise exception 'Subscription end date must be after its start date';
  end if;

  insert into public.shop_subscriptions (
    shop_id, plan_code, amount, billing_period, starts_at, ends_at, status,
    payment_method, transaction_reference, created_by
  ) values (
    payment.shop_id, coalesce(nullif(trim(p_plan_code), ''), p_billing_period),
    payment.amount, p_billing_period, starts_at_value, ends_at_value, 'active',
    payment.payment_method, payment.transaction_reference, auth.uid()
  ) returning id into subscription_id_value;

  update public.shops
  set subscription_plan = coalesce(nullif(trim(p_plan_code), ''), p_billing_period),
      subscription_ends_at = ends_at_value,
      status = 'active', paused_reason = null
  where id = payment.shop_id;

  update public.subscription_payment_requests
  set status = 'verified', subscription_id = subscription_id_value,
      reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = null
  where id = payment.id returning * into payment;

  return payment;
end;
$$;

create or replace function public.sync_expired_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform administrator can synchronize subscriptions';
  end if;

  update public.shop_subscriptions
  set status = 'expired'
  where status in ('trial', 'active') and ends_at is not null and ends_at < now();

  update public.shops
  set status = 'paused', paused_reason = 'Subscription expired'
  where status = 'active' and subscription_ends_at is not null and subscription_ends_at < now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.set_shop_subscription(
  p_shop_id uuid,
  p_plan_code text,
  p_billing_period text,
  p_ends_at timestamptz,
  p_amount numeric default 0,
  p_payment_method text default null,
  p_transaction_reference text default null,
  p_notes text default null
)
returns public.shop_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare saved public.shop_subscriptions;
begin
  if not public.is_platform_admin() then raise exception 'Only a platform administrator can change subscriptions'; end if;
  if not exists (select 1 from public.shops where id=p_shop_id) then raise exception 'Medical shop was not found'; end if;
  if nullif(trim(p_plan_code),'') is null then raise exception 'Enter a plan name'; end if;
  if p_billing_period not in ('trial','monthly','yearly','custom') then raise exception 'Choose a valid billing period'; end if;
  if p_ends_at is null or p_ends_at <= now() then raise exception 'Choose a future valid-until date'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'Amount cannot be negative'; end if;

  insert into public.shop_subscriptions(shop_id,plan_code,amount,billing_period,starts_at,ends_at,status,
    payment_method,transaction_reference,notes,created_by)
  values(p_shop_id,trim(p_plan_code),p_amount,p_billing_period,now(),p_ends_at,
    case when p_billing_period='trial' then 'trial' else 'active' end,
    nullif(trim(p_payment_method),''),nullif(trim(p_transaction_reference),''),nullif(trim(p_notes),''),auth.uid())
  returning * into saved;

  update public.shops set subscription_plan=saved.plan_code,subscription_ends_at=saved.ends_at,
    status='active',paused_reason=null where id=p_shop_id;
  return saved;
end;
$$;

revoke all on function public.review_subscription_payment(uuid,text,text,text,timestamptz,text) from public;
revoke all on function public.sync_expired_subscriptions() from public;
revoke all on function public.set_shop_subscription(uuid,text,text,timestamptz,numeric,text,text,text) from public;
grant execute on function public.review_subscription_payment(uuid,text,text,text,timestamptz,text) to authenticated;
grant execute on function public.sync_expired_subscriptions() to authenticated;
grant execute on function public.set_shop_subscription(uuid,text,text,timestamptz,numeric,text,text,text) to authenticated;

commit;
