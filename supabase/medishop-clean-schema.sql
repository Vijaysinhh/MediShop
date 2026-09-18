-- MediShop clean development schema
--
-- This is a fresh, pharmacy-only schema for a NEW Supabase project.
-- It intentionally contains no passwords, default users, Dukan/grocery data,
-- permissive policies, or destructive DROP statements.
--
-- Apply in the Supabase SQL Editor only after creating a new empty development
-- project. Create the first account through Supabase Auth, then follow the
-- bootstrap note at the bottom of this file.

begin;

create extension if not exists pgcrypto;

create type public.shop_status as enum ('active', 'paused', 'archived');
create type public.shop_role as enum ('owner', 'manager', 'cashier', 'worker');
create type public.movement_type as enum (
  'opening_stock', 'purchase', 'sale', 'sale_return', 'supplier_return',
  'adjustment', 'damage', 'expiry', 'transfer_in', 'transfer_out'
);
create type public.sale_status as enum ('completed', 'held', 'cancelled', 'returned');
create type public.payment_method as enum ('cash', 'upi', 'card', 'credit', 'split');
create type public.purchase_status as enum ('draft', 'received', 'cancelled', 'returned');
create type public.return_status as enum ('sent', 'credit_received', 'cancelled');

-- Auth identity is owned by Supabase. Never add passwords to application tables.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  legal_name text,
  drug_license_number text,
  gstin text,
  phone text,
  email text,
  address text,
  status public.shop_status not null default 'active',
  paused_reason text,
  subscription_plan text not null default 'trial',
  subscription_ends_at timestamptz,
  owner_onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shop_memberships (
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.shop_role not null,
  permissions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

create table public.shop_settings (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  currency text not null default 'INR' check (currency = 'INR'),
  locale text not null default 'en-IN' check (locale = 'en-IN'),
  invoice_prefix text not null default 'MS',
  invoice_footer text,
  allow_negative_stock boolean not null default false,
  expiry_warning_days integer not null default 90 check (expiry_warning_days between 1 and 730),
  updated_at timestamptz not null default now()
);

create table public.shop_subscriptions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  plan_code text not null,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  billing_period text not null check (billing_period in ('trial', 'monthly', 'yearly', 'custom')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status text not null check (status in ('trial', 'active', 'past_due', 'cancelled', 'expired')),
  payment_method text,
  transaction_reference text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Platform-controlled UPI/QR details and the owner payment-verification queue.
create table public.platform_billing_settings (
  id boolean primary key default true check (id),
  upi_id text,
  qr_image_url text,
  payment_instructions text,
  support_phone text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.subscription_payment_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  subscription_id uuid references public.shop_subscriptions(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null default 'upi' check (payment_method in ('upi', 'bank', 'cash', 'other')),
  transaction_reference text not null,
  proof_url text,
  note text,
  status text not null default 'submitted' check (status in ('submitted', 'verified', 'rejected')),
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text
);

create table public.medicine_categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  unique (shop_id, name)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  email text,
  gstin text,
  address text,
  credit_days integer check (credit_days is null or credit_days between 0 and 365),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, name)
);

create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  category_id uuid references public.medicine_categories(id) on delete set null,
  preferred_supplier_id uuid references public.suppliers(id) on delete set null,
  name text not null,
  generic_name text,
  manufacturer text,
  strength text,
  dosage_form text,
  pack_type text,
  pack_size numeric(12,3) check (pack_size is null or pack_size > 0),
  barcode text,
  hsn_code text,
  gst_rate numeric(5,2) not null default 0 check (gst_rate between 0 and 100),
  reorder_level numeric(14,3) not null default 0 check (reorder_level >= 0),
  shelf_location text,
  requires_prescription boolean not null default false,
  schedule_code text check (schedule_code is null or schedule_code in ('H', 'H1', 'X', 'NDPS')),
  cold_storage boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, barcode)
);

create table public.medicine_batches (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete restrict,
  supplier_id uuid references public.suppliers(id) on delete set null,
  batch_number text not null,
  manufacturing_date date,
  expiry_date date,
  mrp numeric(14,2) not null check (mrp >= 0),
  purchase_price numeric(14,2) not null check (purchase_price >= 0),
  selling_price numeric(14,2) not null check (selling_price >= 0),
  quantity_received numeric(14,3) not null default 0 check (quantity_received >= 0),
  quantity_available numeric(14,3) not null default 0 check (quantity_available >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, medicine_id, batch_number, expiry_date)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  credit_limit numeric(14,2) not null default 0 check (credit_limit >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (shop_id, phone)
);

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  image_path text,
  doctor_name text,
  doctor_registration_number text,
  prescribed_on date,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  invoice_number text,
  invoice_date date not null default current_date,
  status public.purchase_status not null default 'draft',
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, supplier_id, invoice_number)
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete restrict,
  batch_id uuid references public.medicine_batches(id) on delete set null,
  quantity numeric(14,3) not null check (quantity > 0),
  purchase_price numeric(14,2) not null check (purchase_price >= 0),
  mrp numeric(14,2) not null check (mrp >= 0),
  gst_rate numeric(5,2) not null default 0 check (gst_rate between 0 and 100),
  line_total numeric(14,2) not null check (line_total >= 0)
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  invoice_number text not null,
  customer_id uuid references public.customers(id) on delete set null,
  prescription_id uuid references public.prescriptions(id) on delete set null,
  status public.sale_status not null default 'completed',
  payment_method public.payment_method not null,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  due_amount numeric(14,2) not null default 0 check (due_amount >= 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  receipt_phone text,
  notes text,
  sold_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, invoice_number),
  check (paid_amount + due_amount = total_amount)
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  medicine_id uuid references public.medicines(id) on delete set null,
  batch_id uuid references public.medicine_batches(id) on delete set null,
  medicine_name text not null,
  batch_number text,
  quantity numeric(14,3) not null check (quantity > 0),
  mrp numeric(14,2) not null check (mrp >= 0),
  selling_price numeric(14,2) not null check (selling_price >= 0),
  purchase_price numeric(14,2) not null check (purchase_price >= 0),
  gst_rate numeric(5,2) not null default 0 check (gst_rate between 0 and 100),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  line_total numeric(14,2) not null check (line_total >= 0)
);

create table public.customer_ledger (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  sale_id uuid references public.sales(id) on delete set null,
  entry_type text not null check (entry_type in ('credit_sale', 'payment', 'adjustment', 'sale_return')),
  amount numeric(14,2) not null check (amount > 0),
  direction text not null check (direction in ('debit', 'credit')),
  payment_method public.payment_method,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.supplier_ledger (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  purchase_id uuid references public.purchases(id) on delete set null,
  entry_type text not null check (entry_type in ('purchase', 'payment', 'return_credit', 'adjustment')),
  amount numeric(14,2) not null check (amount > 0),
  direction text not null check (direction in ('payable', 'paid')),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete restrict,
  batch_id uuid references public.medicine_batches(id) on delete set null,
  movement_type public.movement_type not null,
  quantity_change numeric(14,3) not null check (quantity_change <> 0),
  reference_type text,
  reference_id uuid,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.supplier_returns (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  medicine_id uuid not null references public.medicines(id) on delete restrict,
  batch_id uuid references public.medicine_batches(id) on delete set null,
  quantity numeric(14,3) not null check (quantity > 0),
  expected_credit numeric(14,2) not null check (expected_credit >= 0),
  received_credit numeric(14,2) check (received_credit >= 0),
  status public.return_status not null default 'sent',
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'credit_received' and received_credit is not null) or (status <> 'credit_received'))
);

create table public.refill_reminders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  interval_days integer not null check (interval_days between 1 and 3650),
  last_purchase_on date,
  next_due_on date not null,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, customer_id, medicine_id)
);

create table public.cash_reconciliations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  business_date date not null,
  expected_cash numeric(14,2) not null check (expected_cash >= 0),
  counted_cash numeric(14,2) not null check (counted_cash >= 0),
  difference numeric(14,2) generated always as (counted_cash - expected_cash) stored,
  notes text,
  closed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, business_date)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  shop_id uuid references public.shops(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Timestamp and profile helpers.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.has_shop_access(target_shop_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or exists (
    select 1 from public.shop_memberships
    where shop_id = target_shop_id and user_id = auth.uid() and is_active
  );
$$;

create or replace function public.can_manage_shop(target_shop_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or exists (
    select 1 from public.shop_memberships
    where shop_id = target_shop_id and user_id = auth.uid() and is_active
      and role in ('owner', 'manager')
  );
$$;

create or replace function public.review_subscription_payment(
  p_request_id uuid, p_decision text, p_plan_code text default null,
  p_billing_period text default null, p_custom_ends_at timestamptz default null,
  p_rejection_reason text default null
)
returns public.subscription_payment_requests language plpgsql security definer set search_path = public as $$
declare
  payment public.subscription_payment_requests;
  pharmacy public.shops;
  starts_at_value timestamptz;
  ends_at_value timestamptz;
  subscription_id_value uuid;
begin
  if not public.is_platform_admin() then raise exception 'Only a platform administrator can review subscription payments'; end if;
  if p_decision not in ('verified', 'rejected') then raise exception 'Decision must be verified or rejected'; end if;

  select * into payment from public.subscription_payment_requests where id = p_request_id for update;
  if not found then raise exception 'Payment request was not found'; end if;
  if payment.status <> 'submitted' then raise exception 'Payment request has already been reviewed'; end if;

  if p_decision = 'rejected' then
    update public.subscription_payment_requests
    set status='rejected', reviewed_by=auth.uid(), reviewed_at=now(), rejection_reason=nullif(trim(p_rejection_reason),'')
    where id=payment.id returning * into payment;
    return payment;
  end if;

  if coalesce(p_billing_period,'') not in ('monthly','yearly','custom') then raise exception 'Choose monthly, yearly, or custom billing'; end if;
  select * into pharmacy from public.shops where id=payment.shop_id for update;
  if not found then raise exception 'Medical shop was not found'; end if;
  starts_at_value := greatest(coalesce(pharmacy.subscription_ends_at,now()),now());
  ends_at_value := case when p_custom_ends_at is not null then p_custom_ends_at
    when p_billing_period='monthly' then starts_at_value + interval '1 month'
    when p_billing_period='yearly' then starts_at_value + interval '1 year' else null end;
  if ends_at_value is null or ends_at_value <= starts_at_value then raise exception 'Subscription end date must be after its start date'; end if;

  insert into public.shop_subscriptions(shop_id,plan_code,amount,billing_period,starts_at,ends_at,status,payment_method,transaction_reference,created_by)
  values(payment.shop_id,coalesce(nullif(trim(p_plan_code),''),p_billing_period),payment.amount,p_billing_period,
    starts_at_value,ends_at_value,'active',payment.payment_method,payment.transaction_reference,auth.uid())
  returning id into subscription_id_value;

  update public.shops set subscription_plan=coalesce(nullif(trim(p_plan_code),''),p_billing_period),
    subscription_ends_at=ends_at_value,status='active',paused_reason=null where id=payment.shop_id;
  update public.subscription_payment_requests set status='verified',subscription_id=subscription_id_value,
    reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=null where id=payment.id returning * into payment;
  return payment;
end;
$$;

create or replace function public.sync_expired_subscriptions()
returns integer language plpgsql security definer set search_path = public as $$
declare affected integer;
begin
  if not public.is_platform_admin() then raise exception 'Only a platform administrator can synchronize subscriptions'; end if;
  update public.shop_subscriptions set status='expired'
    where status in ('trial','active') and ends_at is not null and ends_at < now();
  update public.shops set status='paused',paused_reason='Subscription expired'
    where status='active' and subscription_ends_at is not null and subscription_ends_at < now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.set_shop_subscription(
  p_shop_id uuid,p_plan_code text,p_billing_period text,p_ends_at timestamptz,p_amount numeric default 0,
  p_payment_method text default null,p_transaction_reference text default null,p_notes text default null
)
returns public.shop_subscriptions language plpgsql security definer set search_path = public as $$
declare saved public.shop_subscriptions;
begin
  if not public.is_platform_admin() then raise exception 'Only a platform administrator can change subscriptions'; end if;
  if not exists(select 1 from public.shops where id=p_shop_id) then raise exception 'Medical shop was not found'; end if;
  if nullif(trim(p_plan_code),'') is null then raise exception 'Enter a plan name'; end if;
  if p_billing_period not in ('trial','monthly','yearly','custom') then raise exception 'Choose a valid billing period'; end if;
  if p_ends_at is null or p_ends_at<=now() then raise exception 'Choose a future valid-until date'; end if;
  if p_amount is null or p_amount<0 then raise exception 'Amount cannot be negative'; end if;
  insert into public.shop_subscriptions(shop_id,plan_code,amount,billing_period,starts_at,ends_at,status,payment_method,transaction_reference,notes,created_by)
  values(p_shop_id,trim(p_plan_code),p_amount,p_billing_period,now(),p_ends_at,
    case when p_billing_period='trial' then 'trial' else 'active' end,nullif(trim(p_payment_method),''),
    nullif(trim(p_transaction_reference),''),nullif(trim(p_notes),''),auth.uid()) returning * into saved;
  update public.shops set subscription_plan=saved.plan_code,subscription_ends_at=saved.ends_at,
    status='active',paused_reason=null where id=p_shop_id;
  return saved;
end;
$$;

revoke all on function public.review_subscription_payment(uuid,text,text,text,timestamptz,text) from public;
revoke all on function public.sync_expired_subscriptions() from public;
revoke all on function public.set_shop_subscription(uuid,text,text,timestamptz,numeric,text,text,text) from public;

-- Keep all editable records timestamped.
create trigger shops_updated_at before update on public.shops for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger memberships_updated_at before update on public.shop_memberships for each row execute function public.set_updated_at();
create trigger suppliers_updated_at before update on public.suppliers for each row execute function public.set_updated_at();
create trigger medicines_updated_at before update on public.medicines for each row execute function public.set_updated_at();
create trigger batches_updated_at before update on public.medicine_batches for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger purchases_updated_at before update on public.purchases for each row execute function public.set_updated_at();
create trigger sales_updated_at before update on public.sales for each row execute function public.set_updated_at();
create trigger returns_updated_at before update on public.supplier_returns for each row execute function public.set_updated_at();
create trigger refills_updated_at before update on public.refill_reminders for each row execute function public.set_updated_at();
create trigger cash_reconciliations_updated_at before update on public.cash_reconciliations for each row execute function public.set_updated_at();

-- RLS: platform administrators have platform scope; members have only their active shop scope.
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.shops enable row level security;
alter table public.shop_memberships enable row level security;
alter table public.shop_settings enable row level security;
alter table public.shop_subscriptions enable row level security;
alter table public.platform_billing_settings enable row level security;
alter table public.subscription_payment_requests enable row level security;
alter table public.medicine_categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.medicines enable row level security;
alter table public.medicine_batches enable row level security;
alter table public.customers enable row level security;
alter table public.prescriptions enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.customer_ledger enable row level security;
alter table public.supplier_ledger enable row level security;
alter table public.stock_movements enable row level security;
alter table public.supplier_returns enable row level security;
alter table public.refill_reminders enable row level security;
alter table public.cash_reconciliations enable row level security;
alter table public.audit_logs enable row level security;

create policy "read own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.is_platform_admin());
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "platform admins manage platform admins" on public.platform_admins for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "members read accessible shops" on public.shops for select to authenticated using (public.has_shop_access(id));
create policy "platform admins manage shops" on public.shops for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "members read memberships" on public.shop_memberships for select to authenticated using (public.has_shop_access(shop_id));
create policy "owners manage memberships" on public.shop_memberships for all to authenticated using (public.can_manage_shop(shop_id)) with check (public.can_manage_shop(shop_id));

-- Standard shop-scoped policies. Writes requiring stock/balance changes should be
-- performed by authenticated RPCs in the application migration, not direct client writes.
create policy "shop settings access" on public.shop_settings for all to authenticated using (public.has_shop_access(shop_id)) with check (public.can_manage_shop(shop_id));
create policy "platform admins manage subscriptions" on public.shop_subscriptions for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "owners read own subscriptions" on public.shop_subscriptions for select to authenticated using (public.can_manage_shop(shop_id));
create policy "authenticated users read billing settings" on public.platform_billing_settings for select to authenticated using (true);
create policy "platform admins manage billing settings" on public.platform_billing_settings for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "shop managers read payment requests" on public.subscription_payment_requests for select to authenticated using (public.can_manage_shop(shop_id) or public.is_platform_admin());
create policy "shop managers submit payment requests" on public.subscription_payment_requests for insert to authenticated with check (public.can_manage_shop(shop_id) and submitted_by = auth.uid());
create policy "platform admins review payment requests" on public.subscription_payment_requests for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "categories access" on public.medicine_categories for all to authenticated using (public.has_shop_access(shop_id)) with check (public.can_manage_shop(shop_id));
create policy "suppliers access" on public.suppliers for all to authenticated using (public.has_shop_access(shop_id)) with check (public.can_manage_shop(shop_id));
create policy "medicines access" on public.medicines for all to authenticated using (public.has_shop_access(shop_id)) with check (public.can_manage_shop(shop_id));
create policy "batches read" on public.medicine_batches for select to authenticated using (public.has_shop_access(shop_id));
create policy "customers access" on public.customers for all to authenticated using (public.has_shop_access(shop_id)) with check (public.has_shop_access(shop_id));
create policy "prescriptions access" on public.prescriptions for all to authenticated using (public.has_shop_access(shop_id)) with check (public.has_shop_access(shop_id));
create policy "purchases access" on public.purchases for all to authenticated using (public.has_shop_access(shop_id)) with check (public.can_manage_shop(shop_id));
create policy "purchase items access" on public.purchase_items for all to authenticated using (public.has_shop_access(shop_id)) with check (public.can_manage_shop(shop_id));
create policy "sales read" on public.sales for select to authenticated using (public.has_shop_access(shop_id));
create policy "sales create" on public.sales for insert to authenticated with check (public.has_shop_access(shop_id) and sold_by = auth.uid());
create policy "sales update managers" on public.sales for update to authenticated using (public.can_manage_shop(shop_id)) with check (public.can_manage_shop(shop_id));
create policy "sale items read" on public.sale_items for select to authenticated using (public.has_shop_access(shop_id));
create policy "customer ledger read" on public.customer_ledger for select to authenticated using (public.has_shop_access(shop_id));
create policy "supplier ledger access" on public.supplier_ledger for all to authenticated using (public.has_shop_access(shop_id)) with check (public.can_manage_shop(shop_id));
create policy "stock movements read" on public.stock_movements for select to authenticated using (public.has_shop_access(shop_id));
create policy "supplier returns access" on public.supplier_returns for all to authenticated using (public.has_shop_access(shop_id)) with check (public.can_manage_shop(shop_id));
create policy "refill reminders access" on public.refill_reminders for all to authenticated using (public.has_shop_access(shop_id)) with check (public.has_shop_access(shop_id));
create policy "cash reconciliation access" on public.cash_reconciliations for all to authenticated using (public.has_shop_access(shop_id)) with check (public.can_manage_shop(shop_id));
create policy "audit logs read" on public.audit_logs for select to authenticated using (public.can_manage_shop(shop_id) or public.is_platform_admin());

-- Efficient counter, stock, expiry, audit, and dashboard queries.
create index memberships_user_active_idx on public.shop_memberships(user_id, shop_id) where is_active;
create index shop_subscriptions_shop_created_idx on public.shop_subscriptions(shop_id, created_at desc);
create index subscription_payment_requests_status_idx on public.subscription_payment_requests(status, submitted_at desc);
create index subscription_payment_requests_shop_idx on public.subscription_payment_requests(shop_id, submitted_at desc);
create index medicines_shop_search_idx on public.medicines(shop_id, name);
create index medicines_shop_generic_idx on public.medicines(shop_id, generic_name);
create index medicine_batches_fefo_idx on public.medicine_batches(shop_id, medicine_id, expiry_date, quantity_available) where quantity_available > 0;
create index sales_shop_created_idx on public.sales(shop_id, created_at desc);
create index sales_shop_customer_idx on public.sales(shop_id, customer_id);
create index purchases_shop_created_idx on public.purchases(shop_id, created_at desc);
create index stock_movements_shop_created_idx on public.stock_movements(shop_id, created_at desc);
create index customer_ledger_customer_idx on public.customer_ledger(shop_id, customer_id, created_at desc);
create index supplier_ledger_supplier_idx on public.supplier_ledger(shop_id, supplier_id, created_at desc);
create index refill_due_idx on public.refill_reminders(shop_id, next_due_on) where status = 'active';
create index audit_logs_shop_created_idx on public.audit_logs(shop_id, created_at desc);

-- Required because the API is used with authenticated Supabase sessions.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.is_platform_admin(), public.has_shop_access(uuid), public.can_manage_shop(uuid) to authenticated;
grant execute on function public.review_subscription_payment(uuid,text,text,text,timestamptz,text), public.sync_expired_subscriptions() to authenticated;
grant execute on function public.set_shop_subscription(uuid,text,text,timestamptz,numeric,text,text,text) to authenticated;

-- Server-only pharmacy onboarding. Secret/service-role keys bypass RLS but
-- still require PostgreSQL object grants. The role exists in hosted Supabase;
-- the guard keeps this schema portable to the local lightweight test database.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage on schema public to service_role;
    grant select, insert, update, delete on table
      public.profiles,
      public.platform_admins,
      public.shops,
      public.shop_settings,
      public.shop_memberships,
      public.shop_subscriptions
    to service_role;
    grant usage, select on all sequences in schema public to service_role;
  end if;
end $$;

commit;

-- FIRST ADMIN BOOTSTRAP (run manually once, after signing up through Supabase Auth):
-- insert into public.platform_admins (user_id) values ('AUTH_USER_UUID_HERE');
--
-- The platform admin should create shops and owners through a protected server
-- route or Edge Function using the Supabase service-role key. Never expose that
-- key to the browser and never store it in NEXT_PUBLIC_* environment variables.
