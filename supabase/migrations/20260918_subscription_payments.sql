-- Manual UPI subscription workflow for MediShop platform billing.
-- Apply after 20260918_superadmin_subscriptions.sql.

begin;

create table if not exists public.platform_billing_settings (
  id boolean primary key default true check (id),
  upi_id text,
  qr_image_url text,
  payment_instructions text,
  support_phone text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_payment_requests (
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

create index if not exists subscription_payment_requests_status_idx
  on public.subscription_payment_requests(status, submitted_at desc);
create index if not exists subscription_payment_requests_shop_idx
  on public.subscription_payment_requests(shop_id, submitted_at desc);

alter table public.platform_billing_settings enable row level security;
alter table public.subscription_payment_requests enable row level security;

drop policy if exists "authenticated users read billing settings" on public.platform_billing_settings;
drop policy if exists "platform admins manage billing settings" on public.platform_billing_settings;
drop policy if exists "shop managers read payment requests" on public.subscription_payment_requests;
drop policy if exists "shop managers submit payment requests" on public.subscription_payment_requests;
drop policy if exists "platform admins review payment requests" on public.subscription_payment_requests;

create policy "authenticated users read billing settings"
  on public.platform_billing_settings for select to authenticated using (true);
create policy "platform admins manage billing settings"
  on public.platform_billing_settings for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "shop managers read payment requests"
  on public.subscription_payment_requests for select to authenticated
  using (public.can_manage_shop(shop_id) or public.is_platform_admin());
create policy "shop managers submit payment requests"
  on public.subscription_payment_requests for insert to authenticated
  with check (public.can_manage_shop(shop_id) and submitted_by = auth.uid());
create policy "platform admins review payment requests"
  on public.subscription_payment_requests for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

grant select, insert, update on public.platform_billing_settings, public.subscription_payment_requests to authenticated;

commit;
