-- Allow the private Supabase server key to complete pharmacy onboarding.
-- The service_role bypasses RLS, but PostgreSQL table grants are still required.

begin;

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

    -- The current onboarding tables use UUID keys, but this keeps rollback and
    -- future identity-backed additions working without granting browser access.
    grant usage, select on all sequences in schema public to service_role;
  end if;
end $$;

commit;
