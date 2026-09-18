-- Allow anon/authenticated roles to read/write items (required because app uses custom auth, not Supabase Auth)
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'items'
      AND policyname = 'Allow all operations on items (anon/authenticated)'
  ) THEN
    CREATE POLICY "Allow all operations on items (anon/authenticated)"
    ON public.items
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.items TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'items_id_seq'
  ) THEN
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE public.items_id_seq TO anon, authenticated';
  END IF;
END $$;
