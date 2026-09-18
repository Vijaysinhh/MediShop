CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  shop_id BIGINT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL UNIQUE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_shop_id
  ON public.push_subscriptions(shop_id);

CREATE TABLE IF NOT EXISTS public.push_notification_deliveries (
  id BIGSERIAL PRIMARY KEY,
  shop_id BIGINT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  dedupe_key TEXT NOT NULL UNIQUE,
  kind VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_notification_deliveries_shop_id
  ON public.push_notification_deliveries(shop_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on push subscriptions"
  ON public.push_subscriptions;

CREATE POLICY "Allow all operations on push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on push notification deliveries"
  ON public.push_notification_deliveries;

CREATE POLICY "Allow all operations on push notification deliveries"
  ON public.push_notification_deliveries
  FOR ALL
  USING (true)
  WITH CHECK (true);
