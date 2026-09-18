-- Ensure the legacy user_roles table exists with the permissions column the app reads.
CREATE TABLE IF NOT EXISTS public.user_roles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES public.users(id) ON DELETE CASCADE,
    shop_id BIGINT REFERENCES public.shops(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'owner', 'manager', 'cashier', 'worker')),
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_roles
    ADD COLUMN IF NOT EXISTS permissions JSONB;

UPDATE public.user_roles
SET permissions = COALESCE(permissions, '{}'::jsonb)
WHERE permissions IS NULL;

ALTER TABLE public.user_roles
    ALTER COLUMN permissions SET DEFAULT '{}'::jsonb;

ALTER TABLE public.user_roles
    ALTER COLUMN permissions SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_shop_id ON public.user_roles(shop_id);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_roles'
      AND policyname = 'Allow all operations on user_roles'
  ) THEN
    CREATE POLICY "Allow all operations on user_roles"
    ON public.user_roles
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Backfill missing worker permission rows using the same sales-only defaults expected by the app.
INSERT INTO public.user_roles (user_id, shop_id, role, permissions, created_at, updated_at)
SELECT
    u.id,
    u.shop_id,
    'worker',
    jsonb_build_object(
        'canViewDashboard', false,
        'canViewItems', false,
        'canManageItems', false,
        'canViewSales', true,
        'canCreateSales', true,
        'canViewUdhari', false,
        'canManageUdhari', false,
        'canViewReports', false,
        'canViewSettings', false,
        'canManageStaff', false
    ),
    NOW(),
    NOW()
FROM public.users u
WHERE u.role = 'worker'
  AND u.shop_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = u.id
        AND ur.shop_id = u.shop_id
  );
