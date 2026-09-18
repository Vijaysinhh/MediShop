-- Server-backed held bills for counter handoff and later resume.
-- Apply after medishop-clean-schema.sql.

begin;

create table if not exists public.held_bills (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  label text not null,
  customer_id uuid references public.customers(id) on delete set null,
  payment_method public.payment_method not null default 'cash',
  cart jsonb not null check (jsonb_typeof(cart)='array' and jsonb_array_length(cart)>0),
  receipt_phone text,
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists held_bills_shop_created_idx on public.held_bills(shop_id,created_at desc);
alter table public.held_bills enable row level security;
drop policy if exists "shop members manage held bills" on public.held_bills;
create policy "shop members manage held bills" on public.held_bills for all to authenticated
  using (public.has_shop_access(shop_id))
  with check (public.has_shop_access(shop_id) and created_by=auth.uid());
grant select,insert,update,delete on public.held_bills to authenticated;

drop trigger if exists held_bills_updated_at on public.held_bills;
create trigger held_bills_updated_at before update on public.held_bills
for each row execute function public.set_updated_at();

commit;
