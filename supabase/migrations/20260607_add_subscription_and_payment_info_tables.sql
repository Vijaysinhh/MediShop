-- Add subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT REFERENCES shops(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    payment_method VARCHAR(255) NOT NULL,
    transaction_id VARCHAR(255),
    status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'pending', 'failed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add shop_payment_info table
CREATE TABLE IF NOT EXISTS shop_payment_info (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT REFERENCES shops(id) ON DELETE CASCADE,
    upi_id VARCHAR(255),
    qr_code_url TEXT,
    phone_pe VARCHAR(255),
    g_pay VARCHAR(255),
    paytm VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to shops table
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_payment_info ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_shop_id ON subscriptions(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_payment_info_shop_id ON shop_payment_info(shop_id);

-- Add RLS policies for subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscriptions'
      AND policyname = 'Allow all operations on subscriptions'
  ) THEN
    CREATE POLICY "Allow all operations on subscriptions"
    ON public.subscriptions
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Add RLS policies for shop_payment_info
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shop_payment_info'
      AND policyname = 'Allow all operations on shop_payment_info'
  ) THEN
    CREATE POLICY "Allow all operations on shop_payment_info"
    ON public.shop_payment_info
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;
