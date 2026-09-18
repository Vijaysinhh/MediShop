-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES (mirroring IndexedDB structure)
-- ============================================

-- 1. Shops
CREATE TABLE IF NOT EXISTS shops (
    id BIGSERIAL PRIMARY KEY,
    owner_name VARCHAR(255) NOT NULL,
    shop_name VARCHAR(255) NOT NULL,
    address TEXT,
    phone_number VARCHAR(50) NOT NULL,
    password TEXT NOT NULL,
    is_paused BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Users (super admin, owner, worker)
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT REFERENCES shops(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    password TEXT NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'owner', 'worker')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Categories
CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    name_marathi VARCHAR(255),
    color VARCHAR(7),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Units
CREATE TABLE IF NOT EXISTS units (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    name_marathi VARCHAR(255),
    short_form VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Items
CREATE TABLE IF NOT EXISTS items (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255),
    name_marathi VARCHAR(255),
    brand VARCHAR(255),
    brand_marathi VARCHAR(255),
    category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    unit_id BIGINT REFERENCES units(id) ON DELETE SET NULL,
    quantity NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    expiry_date TIMESTAMP WITH TIME ZONE,
    buy_price NUMERIC NOT NULL,
    sell_price NUMERIC NOT NULL,
    margin_amount NUMERIC,
    margin_percent NUMERIC,
    low_stock_limit NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE items
ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP WITH TIME ZONE;

-- 6. Price Tiers
CREATE TABLE IF NOT EXISTS price_tiers (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT REFERENCES shops(id) ON DELETE CASCADE,
    item_id BIGINT REFERENCES items(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL,
    unit_id BIGINT REFERENCES units(id) ON DELETE SET NULL,
    price NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Sales
CREATE TABLE IF NOT EXISTS sales (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT REFERENCES shops(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    total_quantity_items NUMERIC,
    subtotal NUMERIC NOT NULL,
    total_cost NUMERIC NOT NULL,
    total_profit NUMERIC NOT NULL,
    profit_margin_percent NUMERIC,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'card', 'partial', 'udhari')),
    paid_amount NUMERIC NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    due_amount NUMERIC NOT NULL DEFAULT 0 CHECK (due_amount >= 0),
    paid_via VARCHAR(20) CHECK (paid_via IS NULL OR paid_via IN ('cash', 'card')),
    credit_customer_id BIGINT,
    credit_customer_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT REFERENCES shops(id) ON DELETE CASCADE,
    sale_id BIGINT REFERENCES sales(id) ON DELETE CASCADE,
    item_id BIGINT REFERENCES items(id) ON DELETE SET NULL,
    item_name VARCHAR(255) NOT NULL,
    quantity NUMERIC NOT NULL,
    display_quantity VARCHAR(255),
    unit_id BIGINT REFERENCES units(id) ON DELETE SET NULL,
    unit_short_form VARCHAR(50),
    price_tier_id BIGINT,
    pack_count NUMERIC,
    price_tier_quantity NUMERIC,
    price_tier_unit_short_form VARCHAR(50),
    price_per_unit NUMERIC NOT NULL,
    total_price NUMERIC NOT NULL,
    cost_per_unit NUMERIC NOT NULL,
    total_cost NUMERIC NOT NULL,
    profit NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Stock History
CREATE TABLE IF NOT EXISTS stock_history (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT REFERENCES shops(id) ON DELETE CASCADE,
    item_id BIGINT REFERENCES items(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('purchase', 'sale', 'adjustment', 'damage', 'expiry')),
    quantity_changed NUMERIC NOT NULL,
    quantity_before NUMERIC NOT NULL,
    quantity_after NUMERIC NOT NULL,
    reason TEXT,
    cost_per_unit NUMERIC,
    reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Batches
CREATE TABLE IF NOT EXISTS batches (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT REFERENCES shops(id) ON DELETE CASCADE,
    item_id BIGINT REFERENCES items(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    batch_number VARCHAR(255),
    purchase_date TIMESTAMP WITH TIME ZONE NOT NULL,
    expiry_date TIMESTAMP WITH TIME ZONE,
    quantity_received NUMERIC NOT NULL CHECK (quantity_received >= 0),
    quantity_sold NUMERIC DEFAULT 0 CHECK (quantity_sold >= 0),
    quantity_available NUMERIC NOT NULL CHECK (quantity_available >= 0),
    cost_per_unit NUMERIC NOT NULL,
    supplier_id TEXT,
    status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'expiring', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT REFERENCES shops(id) ON DELETE CASCADE,
    item_id BIGINT REFERENCES items(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('low_stock', 'expiring', 'slow_moving', 'expired')),
    message TEXT NOT NULL,
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Credit Customers
CREATE TABLE IF NOT EXISTS credit_customers (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    balance NUMERIC DEFAULT 0 CHECK (balance >= 0),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Credit Entries
CREATE TABLE IF NOT EXISTS credit_entries (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT REFERENCES shops(id) ON DELETE CASCADE,
    customer_id BIGINT REFERENCES credit_customers(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('credit', 'payment')),
    amount NUMERIC NOT NULL,
    note TEXT,
    sale_id BIGINT REFERENCES sales(id) ON DELETE SET NULL,
    bill_items JSONB,
    date DATE NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. App Settings (per shop)
CREATE TABLE IF NOT EXISTS app_settings (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT REFERENCES shops(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL DEFAULT 'mr' CHECK (language IN ('en', 'mr')),
    theme VARCHAR(20) NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
    setup_complete BOOLEAN DEFAULT TRUE,
    last_backup TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. Subscriptions
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

-- 16. Shop Payment Info
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

-- Add missing columns to shops table for subscription info
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP WITH TIME ZONE;

-- 17. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT REFERENCES shops(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('create', 'update', 'delete')),
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(255) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 18. User Roles
CREATE TABLE IF NOT EXISTS user_roles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    shop_id BIGINT REFERENCES shops(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'owner', 'manager', 'cashier', 'worker')),
    permissions JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 19. System Health Checks
CREATE TABLE IF NOT EXISTS system_health_checks (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT REFERENCES shops(id) ON DELETE CASCADE,
    check_type VARCHAR(50) NOT NULL CHECK (check_type IN ('database', 'api', 'storage', 'auth')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
    response_time_ms INTEGER,
    error_message TEXT,
    details JSONB,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INSERT SUPER ADMIN USER
-- ============================================
INSERT INTO users (username, password, role) 
VALUES ('vijaysinhjadhav23@gmail.com', 'Vijaysinh@23', 'super_admin')
ON CONFLICT DO NOTHING;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_shops_owner_name ON shops(owner_name);
CREATE INDEX IF NOT EXISTS idx_shops_phone_number ON shops(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_shop_id ON users(shop_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_items_shop_id ON items(shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_shop_id ON sales(shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_credit_customers_shop_id ON credit_customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_credit_entries_shop_id ON credit_entries(shop_id);
CREATE INDEX IF NOT EXISTS idx_credit_entries_customer_id ON credit_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_shop_id ON subscriptions(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_payment_info_shop_id ON shop_payment_info(shop_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_shop_id ON audit_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_shop_id ON user_roles(shop_id);
CREATE INDEX IF NOT EXISTS idx_system_health_checks_shop_id ON system_health_checks(shop_id);
CREATE INDEX IF NOT EXISTS idx_system_health_checks_checked_at ON system_health_checks(checked_at);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_payment_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_checks ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's shop ID (simplified for now)
-- For this app, we'll use permissive policies since we're using custom auth
-- In production, you'd want to integrate with Supabase Auth properly

-- Shops: Allow all operations (adjust as needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shops'
      AND policyname = 'Allow all operations on shops'
  ) THEN
    CREATE POLICY "Allow all operations on shops"
    ON public.shops
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Users: Allow all operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'Allow all operations on users'
  ) THEN
    CREATE POLICY "Allow all operations on users"
    ON public.users
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Categories: Allow all operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'categories'
      AND policyname = 'Allow all operations on categories'
  ) THEN
    CREATE POLICY "Allow all operations on categories"
    ON public.categories
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Units: Allow all operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'units'
      AND policyname = 'Allow all operations on units'
  ) THEN
    CREATE POLICY "Allow all operations on units"
    ON public.units
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Items: Allow all operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'items'
      AND policyname = 'Allow all operations on items'
  ) THEN
    CREATE POLICY "Allow all operations on items"
    ON public.items
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Price Tiers: Allow all operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'price_tiers'
      AND policyname = 'Allow all operations on price_tiers'
  ) THEN
    CREATE POLICY "Allow all operations on price_tiers"
    ON public.price_tiers
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Sales: Allow all operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sales'
      AND policyname = 'Allow all operations on sales'
  ) THEN
    CREATE POLICY "Allow all operations on sales"
    ON public.sales
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Sale Items: Allow all operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sale_items'
      AND policyname = 'Allow all operations on sale_items'
  ) THEN
    CREATE POLICY "Allow all operations on sale_items"
    ON public.sale_items
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Stock History: Allow all operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stock_history'
      AND policyname = 'Allow all operations on stock_history'
  ) THEN
    CREATE POLICY "Allow all operations on stock_history"
    ON public.stock_history
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Batches: Allow all operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'batches'
      AND policyname = 'Allow all operations on batches'
  ) THEN
    CREATE POLICY "Allow all operations on batches"
    ON public.batches
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Alerts: Allow all operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'alerts'
      AND policyname = 'Allow all operations on alerts'
  ) THEN
    CREATE POLICY "Allow all operations on alerts"
    ON public.alerts
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Credit Customers: Allow all operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'credit_customers'
      AND policyname = 'Allow all operations on credit_customers'
  ) THEN
    CREATE POLICY "Allow all operations on credit_customers"
    ON public.credit_customers
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Credit Entries: Allow all operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'credit_entries'
      AND policyname = 'Allow all operations on credit_entries'
  ) THEN
    CREATE POLICY "Allow all operations on credit_entries"
    ON public.credit_entries
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- App Settings: Allow all operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'app_settings'
      AND policyname = 'Allow all operations on app_settings'
  ) THEN
    CREATE POLICY "Allow all operations on app_settings"
    ON public.app_settings
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Subscriptions: Allow all operations
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

-- Shop Payment Info: Allow all operations
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

-- Audit Logs: Allow all operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_logs'
      AND policyname = 'Allow all operations on audit_logs'
  ) THEN
    CREATE POLICY "Allow all operations on audit_logs"
    ON public.audit_logs
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- User Roles: Allow all operations
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

-- System Health Checks: Allow all operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'system_health_checks'
      AND policyname = 'Allow all operations on system_health_checks'
  ) THEN
    CREATE POLICY "Allow all operations on system_health_checks"
    ON public.system_health_checks
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- =============================================
-- Audit Logs Table
-- =============================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  user_id UUID REFERENCES auth.users(id),
  shop_id UUID REFERENCES public.shops(id),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_shop_id ON public.audit_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit Logs: Allow all operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_logs'
      AND policyname = 'Allow all operations on audit_logs'
  ) THEN
    CREATE POLICY "Allow all operations on audit_logs"
    ON public.audit_logs
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- =============================================
-- User Roles Table (Role-Based Access Control)
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'manager', 'cashier', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, shop_id)
);

-- Indexes for user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_shop_id ON public.user_roles(shop_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- User Roles: Allow all operations
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

-- =============================================
-- System Health Checks Table
-- =============================================
CREATE TABLE IF NOT EXISTS public.system_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'critical')),
  message TEXT,
  details JSONB,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for system_health_checks
CREATE INDEX IF NOT EXISTS idx_health_checks_checked_at ON public.system_health_checks(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_checks_status ON public.system_health_checks(status);

-- Enable RLS
ALTER TABLE public.system_health_checks ENABLE ROW LEVEL SECURITY;

-- System Health Checks: Allow all operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'system_health_checks'
      AND policyname = 'Allow all operations on system_health_checks'
  ) THEN
    CREATE POLICY "Allow all operations on system_health_checks"
    ON public.system_health_checks
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- IDEMPOTENT COLUMN MIGRATIONS (for existing DBs)
-- ============================================

-- sale_items: ensure all newer columns exist
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS display_quantity VARCHAR(255);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS unit_short_form VARCHAR(50);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS price_tier_id BIGINT;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS pack_count NUMERIC;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS price_tier_quantity NUMERIC;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS price_tier_unit_short_form VARCHAR(50);

-- sales: ensure all newer columns exist
ALTER TABLE sales ADD COLUMN IF NOT EXISTS total_quantity_items NUMERIC;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS profit_margin_percent NUMERIC;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS credit_customer_id BIGINT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS credit_customer_name VARCHAR(255);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS paid_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS due_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS paid_via VARCHAR(20);
