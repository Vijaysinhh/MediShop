-- MediShop superadmin shop lifecycle and subscription records.
-- Apply after medishop-clean-schema.sql.

begin;

alter table public.shops
  add column if not exists subscription_plan text not null default 'trial',
  add column if not exists subscription_ends_at timestamptz,
  add column if not exists owner_onboarded_at timestamptz;

create table if not exists public.shop_subscriptions (
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

alter table public.shop_subscriptions enable row level security;
drop policy if exists "platform admins manage subscriptions" on public.shop_subscriptions;
drop policy if exists "owners read own subscriptions" on public.shop_subscriptions;

create policy "platform admins manage subscriptions"
  on public.shop_subscriptions for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "owners read own subscriptions"
  on public.shop_subscriptions for select to authenticated
  using (public.can_manage_shop(shop_id));

create index if not exists shop_subscriptions_shop_created_idx
  on public.shop_subscriptions(shop_id, created_at desc);

grant select, insert, update, delete on public.shop_subscriptions to authenticated;

commit;
