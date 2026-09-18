-- MediShop development database setup. No default accounts or credentials are included.
-- Run this entire file in the Supabase SQL Editor for the development project only.

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

-- MIGRATION: 20260602_sale_items_display.sql
-- Run in Supabase SQL editor if sale_items already exists without display columns
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS display_quantity VARCHAR(255);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS unit_short_form VARCHAR(50);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS price_tier_id BIGINT;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS pack_count NUMERIC;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS price_tier_quantity NUMERIC;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS price_tier_unit_short_form VARCHAR(50);


-- MIGRATION: 20260605_batch_quantities_check.sql
-- Add CHECK constraints to ensure batches quantities are never negative
ALTER TABLE batches
ADD CONSTRAINT batches_quantity_received_check
CHECK (quantity_received >= 0);

ALTER TABLE batches
ADD CONSTRAINT batches_quantity_sold_check
CHECK (quantity_sold >= 0);

ALTER TABLE batches
ADD CONSTRAINT batches_quantity_available_check
CHECK (quantity_available >= 0);


-- MIGRATION: 20260605_credit_customer_balance_check.sql
-- Add CHECK constraint to ensure credit_customers.balance is never negative
ALTER TABLE credit_customers
ADD CONSTRAINT credit_customers_balance_check
CHECK (balance >= 0);


-- MIGRATION: 20260605_item_quantity_check.sql
-- Add CHECK constraint to ensure items.quantity is never negative
ALTER TABLE items
ADD CONSTRAINT items_quantity_check
CHECK (quantity >= 0);


-- MIGRATION: 20260607_add_brand_to_items.sql
-- Add brand columns to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS brand VARCHAR(255);
ALTER TABLE items ADD COLUMN IF NOT EXISTS brand_marathi VARCHAR(255);


-- MIGRATION: 20260607_add_subscription_and_payment_info_tables.sql
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


-- MIGRATION: 20260607_items_allow_all_policy.sql
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


-- MIGRATION: 20260609_make_item_name_nullable.sql
-- Make item name nullable to allow only Marathi name
ALTER TABLE items ALTER COLUMN name DROP NOT NULL;


-- MIGRATION: 20260627_atomic_stock_updates.sql
-- Atomic stock update function to prevent race conditions
-- This function safely decrements item quantity and ensures it doesn't go negative

CREATE OR REPLACE FUNCTION decrement_item_quantity(item_id BIGINT, qty_to_subtract NUMERIC)
RETURNS SETOF items
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_item items%ROWTYPE;
BEGIN
  -- Perform the update atomically with a check to prevent negative quantity
  UPDATE items
  SET
    quantity = quantity - qty_to_subtract,
    updated_at = NOW()
  WHERE
    id = item_id
    AND quantity >= qty_to_subtract
  RETURNING * INTO v_updated_item;

  -- If the update affected no rows, check why
  IF NOT FOUND THEN
    -- Check if the item exists at all
    IF EXISTS (SELECT 1 FROM items WHERE id = item_id) THEN
      RAISE EXCEPTION 'Insufficient stock for item %', item_id;
    ELSE
      RAISE EXCEPTION 'Item % not found', item_id;
    END IF;
  END IF;

  -- Return the updated item
  RETURN NEXT v_updated_item;
END;
$$;

-- Also create a function to increment stock (for restores/returns)
CREATE OR REPLACE FUNCTION increment_item_quantity(item_id BIGINT, qty_to_add NUMERIC)
RETURNS SETOF items
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_item items%ROWTYPE;
BEGIN
  UPDATE items
  SET
    quantity = quantity + qty_to_add,
    updated_at = NOW()
  WHERE
    id = item_id
  RETURNING * INTO v_updated_item;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item % not found', item_id;
  END IF;

  RETURN NEXT v_updated_item;
END;
$$;


-- MIGRATION: 20260715_add_push_notifications.sql
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


-- MIGRATION: 20260719_worker_permissions_parity.sql
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


-- MIGRATION: 20260818_shop_starter_catalog.sql
-- Starter catalog source. Products are copied into each shop's own items table.
-- Existing manual items, prices, stock, price tiers, edits and deletes are untouched.
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS catalog_code TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS icon_key TEXT NOT NULL DEFAULT 'package';
CREATE UNIQUE INDEX IF NOT EXISTS items_shop_catalog_code_unique
  ON public.items(shop_id, catalog_code) WHERE catalog_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.catalog_products (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_marathi TEXT,
  category_name TEXT NOT NULL,
  unit_short_form TEXT NOT NULL,
  icon_key TEXT NOT NULL DEFAULT 'package'
);

INSERT INTO public.catalog_products (code,name,name_marathi,category_name,unit_short_form,icon_key) VALUES
('rice','Rice','à¤¤à¤¾à¤‚à¤¦à¥‚à¤³','Grocery','kg','grain'),
('wheat-flour','Wheat Flour','à¤—à¤µà¥à¤¹à¤¾à¤šà¥‡ à¤ªà¥€à¤ ','Grocery','kg','grain'),
('toor-dal','Toor Dal','à¤¤à¥‚à¤° à¤¡à¤¾à¤³','Grocery','kg','pulse'),
('moong-dal','Moong Dal','à¤®à¥‚à¤— à¤¡à¤¾à¤³','Grocery','kg','pulse'),
('chana-dal','Chana Dal','à¤šà¤£à¤¾ à¤¡à¤¾à¤³','Grocery','kg','pulse'),
('sugar','Sugar','à¤¸à¤¾à¤–à¤°','Grocery','kg','grain'),
('jaggery','Jaggery','à¤—à¥‚à¤³','Grocery','kg','grain'),
('salt','Iodised Salt','à¤†à¤¯à¥‹à¤¡à¥€à¤¨à¤¯à¥à¤•à¥à¤¤ à¤®à¥€à¤ ','Grocery','kg','package'),
('groundnut-oil','Groundnut Oil','à¤¶à¥‡à¤‚à¤—à¤¦à¤¾à¤£à¤¾ à¤¤à¥‡à¤²','Grocery','L','bottle'),
('sunflower-oil','Sunflower Oil','à¤¸à¥‚à¤°à¥à¤¯à¤«à¥‚à¤² à¤¤à¥‡à¤²','Grocery','L','bottle'),
('tea','Tea Powder','à¤šà¤¹à¤¾ à¤ªà¤¾à¤µà¤¡à¤°','Grocery','packet','package'),
('turmeric','Turmeric Powder','à¤¹à¤³à¤¦ à¤ªà¤¾à¤µà¤¡à¤°','Grocery','g','spice'),
('chilli','Red Chilli Powder','à¤²à¤¾à¤² à¤¤à¤¿à¤–à¤Ÿ','Grocery','g','spice'),
('pav-bhaji-masala','Pav Bhaji Masala','à¤ªà¤¾à¤µà¤­à¤¾à¤œà¥€ à¤®à¤¸à¤¾à¤²à¤¾','Grocery','packet','spice'),
('garam-masala','Garam Masala','à¤—à¤°à¤® à¤®à¤¸à¤¾à¤²à¤¾','Grocery','packet','spice'),
('biscuits','Biscuits','à¤¬à¤¿à¤¸à¥à¤•à¤¿à¤Ÿà¥‡','Snacks & Sweets','packet','snack'),
('parle-g','Parle-G Biscuits','à¤ªà¤¾à¤°à¥à¤²à¥‡-à¤œà¥€ à¤¬à¤¿à¤¸à¥à¤•à¤¿à¤Ÿà¥‡','Snacks & Sweets','packet','snack'),
('lays','Lays','à¤²à¥‡à¤œ','Snacks & Sweets','packet','snack'),
('kurkure','Kurkure','à¤•à¥à¤°à¤•à¥à¤°à¥‡','Snacks & Sweets','packet','snack'),
('farsan','Farsan','à¤«à¤°à¤¸à¤¾à¤£','Snacks & Sweets','packet','snack'),
('sev','Sev','à¤¶à¥‡à¤µ','Snacks & Sweets','packet','snack'),
('milk','Milk','à¤¦à¥‚à¤§','Dairy & Milk','L','bottle'),
('bread','Bread','à¤¬à¥à¤°à¥‡à¤¡','Dairy & Milk','pcs','package'),
('eggs','Eggs','à¤…à¤‚à¤¡à¥€','Dairy & Milk','pcs','package'),
('water','Packaged Water','à¤ªà¥…à¤•à¥‡à¤œà¥à¤¡ à¤ªà¤¾à¤£à¥€','Beverages','bottle','bottle'),
('soft-drink','Soft Drink','à¤¶à¥€à¤¤à¤ªà¥‡à¤¯','Beverages','bottle','bottle'),
('santoor','Santoor Soap','à¤¸à¤‚à¤¤à¥‚à¤° à¤¸à¤¾à¤¬à¤£','Personal Care','pcs','soap'),
('dettol-soap','Dettol Soap','à¤¡à¥‡à¤Ÿà¥‰à¤² à¤¸à¤¾à¤¬à¤£','Personal Care','pcs','soap'),
('lifebuoy','Lifebuoy Soap','à¤²à¤¾à¤‡à¤«à¤¬à¥‰à¤¯ à¤¸à¤¾à¤¬à¤£','Personal Care','pcs','soap'),
('shampoo-pouch','Shampoo Sachet','à¤¶à¥…à¤®à¥à¤ªà¥‚ à¤ªà¥à¤¡à¥€','Personal Care','sachet','personal'),
('hair-oil','Hair Oil','à¤•à¥‡à¤¸à¤¾à¤‚à¤šà¥‡ à¤¤à¥‡à¤²','Personal Care','bottle','bottle'),
('toothpaste','Toothpaste','à¤Ÿà¥‚à¤¥à¤ªà¥‡à¤¸à¥à¤Ÿ','Personal Care','pcs','personal'),
('detergent','Detergent Powder','à¤¡à¤¿à¤Ÿà¤°à¥à¤œà¤‚à¤Ÿ à¤ªà¤¾à¤µà¤¡à¤°','Household Items','pcs','cleaning'),
('dishwash-bar','Dishwash Bar','à¤­à¤¾à¤‚à¤¡à¥€ à¤˜à¤¾à¤¸à¤£à¥à¤¯à¤¾à¤šà¤¾ à¤¸à¤¾à¤¬à¤£','Household Items','pcs','cleaning'),
('matchbox','Matchbox','à¤†à¤—à¤ªà¥‡à¤Ÿà¥€','Household Items','box','package'),
('candle','Candle','à¤®à¥‡à¤£à¤¬à¤¤à¥à¤¤à¥€','Household Items','pcs','package'),
('agarbatti','Agarbatti','à¤…à¤—à¤°à¤¬à¤¤à¥à¤¤à¥€','Pooja & Festival','packet','pooja'),
('camphor','Camphor','à¤•à¤¾à¤ªà¥‚à¤°','Pooja & Festival','packet','pooja'),
('kumkum','Kumkum','à¤•à¥à¤‚à¤•à¥‚','Pooja & Festival','packet','pooja'),
('rangoli','Colour Rangoli','à¤°à¤‚à¤—à¥€à¤¤ à¤°à¤¾à¤‚à¤—à¥‹à¤³à¥€','Pooja & Festival','packet','pooja')
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, name_marathi=EXCLUDED.name_marathi,
  category_name=EXCLUDED.category_name, unit_short_form=EXCLUDED.unit_short_form,
  icon_key=EXCLUDED.icon_key;

-- Repair the old malformed Marathi label only when it is blank or mojibake.
-- A shopkeeper's valid custom translation is never overwritten.
UPDATE public.categories
SET name_marathi = 'à¤ªà¥‡à¤¯ à¤ªà¤¦à¤¾à¤°à¥à¤¥', updated_at = NOW()
WHERE lower(trim(name)) = 'beverages'
  AND (name_marathi IS NULL OR position('Ã ' IN name_marathi) > 0);

CREATE OR REPLACE FUNCTION public.seed_shop_starter_catalog(p_shop_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  -- Ensure every catalog dependency exists in this shop before resolving IDs.
  INSERT INTO categories (shop_id,name,name_marathi,color)
  SELECT p_shop_id,v.name,v.name_marathi,v.color FROM (VALUES
    ('Grocery','à¤•à¤¿à¤°à¤¾à¤£à¤¾','#3b82f6'), ('Dairy & Milk','à¤¦à¥à¤—à¥à¤§','#f59e0b'),
    ('Beverages','à¤ªà¥‡à¤¯ à¤ªà¤¦à¤¾à¤°à¥à¤¥','#ef4444'), ('Snacks & Sweets','à¤¸à¥à¤¨à¥…à¤•à¥à¤¸ à¤µ à¤®à¤¿à¤ à¤¾à¤ˆ','#8b5cf6'),
    ('Household Items','à¤˜à¤°à¤—à¥à¤¤à¥€ à¤µà¤¸à¥à¤¤à¥‚','#06b6d4'), ('Personal Care','à¤µà¥ˆà¤¯à¤•à¥à¤¤à¤¿à¤• à¤¸à¥à¤µà¤šà¥à¤›à¤¤à¤¾','#ec4899'),
    ('Pooja & Festival','à¤ªà¥‚à¤œà¤¾ à¤µ à¤¸à¤£à¤¾à¤¸à¥à¤¦à¥€à¤šà¥‡ à¤¸à¤¾à¤¹à¤¿à¤¤à¥à¤¯','#f97316')
  ) AS v(name,name_marathi,color)
  WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.shop_id=p_shop_id AND lower(trim(c.name))=lower(trim(v.name)));

  INSERT INTO units (shop_id,name,name_marathi,short_form)
  SELECT p_shop_id,v.name,v.name_marathi,v.short_form FROM (VALUES
    ('Kilogram','à¤•à¤¿à¤²à¥‹à¤—à¥à¤°à¥…à¤®','kg'), ('Gram','à¤—à¥à¤°à¥…à¤®','g'), ('Liter','à¤²à¤¿à¤Ÿà¤°','L'),
    ('Piece','à¤¨à¤—','pcs'), ('Box','à¤¬à¥‰à¤•à¥à¤¸','box'), ('Packet','à¤ªà¥…à¤•à¥‡à¤Ÿ','packet'),
    ('Bottle','à¤¬à¤¾à¤Ÿà¤²à¥€','bottle'), ('Sachet','à¤ªà¥à¤¡à¥€','sachet')
  ) AS v(name,name_marathi,short_form)
  WHERE NOT EXISTS (SELECT 1 FROM units u WHERE u.shop_id=p_shop_id AND lower(trim(u.short_form))=lower(trim(v.short_form)));

  INSERT INTO items (shop_id,catalog_code,icon_key,name,name_marathi,category_id,unit_id,quantity,buy_price,sell_price,low_stock_limit)
  SELECT p_shop_id,p.code,p.icon_key,p.name,p.name_marathi,c.id,u.id,0,0,0,0
  FROM catalog_products p
  JOIN LATERAL (SELECT id FROM categories c WHERE c.shop_id=p_shop_id AND lower(trim(c.name))=lower(trim(p.category_name)) ORDER BY id LIMIT 1) c ON TRUE
  JOIN LATERAL (SELECT id FROM units u WHERE u.shop_id=p_shop_id AND lower(trim(u.short_form))=lower(trim(p.unit_short_form)) ORDER BY id LIMIT 1) u ON TRUE
  WHERE NOT EXISTS (
    SELECT 1 FROM items i
    WHERE i.shop_id=p_shop_id
      AND (
        i.catalog_code=p.code
        OR lower(trim(coalesce(i.name,'')))=lower(trim(p.name))
        OR lower(trim(coalesce(i.name_marathi,'')))=lower(trim(coalesce(p.name_marathi,'')))
      )
  );
END; $$;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.catalog_products FROM anon, authenticated;
GRANT SELECT ON TABLE public.catalog_products TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_shop_starter_catalog(BIGINT) TO anon, authenticated;

-- One-time, idempotent seed for existing shops. It only inserts missing catalog products.
SELECT public.seed_shop_starter_catalog(id) FROM public.shops;


-- MIGRATION: 20260910_partial_payments.sql
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_via VARCHAR(20);

UPDATE public.sales
SET paid_amount = subtotal
WHERE payment_method IN ('cash', 'card') AND paid_amount = 0;

UPDATE public.sales
SET due_amount = subtotal
WHERE payment_method = 'udhari' AND due_amount = 0;

UPDATE public.sales
SET paid_via = payment_method
WHERE payment_method IN ('cash', 'card') AND paid_via IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_paid_amount_nonnegative') THEN
    ALTER TABLE public.sales ADD CONSTRAINT sales_paid_amount_nonnegative CHECK (paid_amount >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_due_amount_nonnegative') THEN
    ALTER TABLE public.sales ADD CONSTRAINT sales_due_amount_nonnegative CHECK (due_amount >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_paid_via_valid') THEN
    ALTER TABLE public.sales ADD CONSTRAINT sales_paid_via_valid CHECK (paid_via IS NULL OR paid_via IN ('cash', 'card'));
  END IF;
END $$;


-- MIGRATION: 20260917_pharmacy_workflows.sql
-- MediShop development extension. Additive; no customer/catalog data is deleted.
-- Apply after the existing schema and earlier migrations.
-- New-table policies follow this development app's existing custom-auth model.
-- These permissive policies are not production tenant authorization.
BEGIN;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS catalog_code text,
  ADD COLUMN IF NOT EXISTS icon_key text NOT NULL DEFAULT 'pill',
  ADD COLUMN IF NOT EXISTS generic_name text,
  ADD COLUMN IF NOT EXISTS strength text,
  ADD COLUMN IF NOT EXISTS dosage_form text,
  ADD COLUMN IF NOT EXISTS pack_type text,
  ADD COLUMN IF NOT EXISTS shelf_location text,
  ADD COLUMN IF NOT EXISTS batch_number text,
  ADD COLUMN IF NOT EXISTS gst_rate numeric CHECK (gst_rate >= 0 AND gst_rate <= 100),
  ADD COLUMN IF NOT EXISTS requires_prescription boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cold_storage boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS supplier_phone text;

ALTER TABLE public.credit_customers
  ADD COLUMN IF NOT EXISTS repeat_medicine text,
  ADD COLUMN IF NOT EXISTS repeat_every_days integer CHECK (repeat_every_days BETWEEN 1 AND 3650),
  ADD COLUMN IF NOT EXISTS last_purchase_date date;

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS receipt_phone text;
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS generic_name text,
  ADD COLUMN IF NOT EXISTS strength text,
  ADD COLUMN IF NOT EXISTS dosage_form text,
  ADD COLUMN IF NOT EXISTS gst_rate numeric CHECK (gst_rate >= 0 AND gst_rate <= 100);

ALTER TABLE public.app_settings ALTER COLUMN language SET DEFAULT 'en';

CREATE TABLE IF NOT EXISTS public.cash_reconciliations (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  shop_id bigint NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  date date NOT NULL,
  counted_amount numeric(14,2) NOT NULL CHECK (counted_amount >= 0),
  expected_amount numeric(14,2) NOT NULL CHECK (expected_amount >= 0),
  difference numeric(14,2) GENERATED ALWAYS AS (counted_amount - expected_amount) STORED,
  user_id bigint REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shop_id, date)
);

CREATE TABLE IF NOT EXISTS public.medicine_returns (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  shop_id bigint NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  item_id bigint REFERENCES public.items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  batch_number text,
  supplier_name text,
  quantity numeric NOT NULL CHECK (quantity > 0),
  expected_credit numeric(14,2) NOT NULL CHECK (expected_credit >= 0),
  received_credit numeric(14,2) CHECK (received_credit >= 0),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'credited')),
  user_id bigint REFERENCES public.users(id) ON DELETE SET NULL,
  request_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'sent' AND received_credit IS NULL) OR (status = 'credited' AND received_credit IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS medicine_returns_shop_created ON public.medicine_returns(shop_id, created_at DESC);
ALTER TABLE public.cash_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_returns ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cash_reconciliations' AND policyname='Development custom-auth cash access') THEN
    CREATE POLICY "Development custom-auth cash access" ON public.cash_reconciliations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='medicine_returns' AND policyname='Development custom-auth returns access') THEN
    CREATE POLICY "Development custom-auth returns access" ON public.medicine_returns FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE ON public.cash_reconciliations, public.medicine_returns TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.cash_reconciliations_id_seq, public.medicine_returns_id_seq TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.reconcile_pharmacy_cash(p_shop_id bigint, p_date date, p_counted_amount numeric, p_user_id bigint)
RETURNS SETOF public.cash_reconciliations LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE expected numeric; saved public.cash_reconciliations;
BEGIN
  IF p_counted_amount IS NULL OR p_counted_amount < 0 OR p_counted_amount::text IN ('NaN','Infinity','-Infinity') OR p_date IS NULL THEN
    RAISE EXCEPTION 'Enter a date and a valid non-negative counted amount';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_user_id AND shop_id=p_shop_id AND role='owner') THEN RAISE EXCEPTION 'An owner in this pharmacy is required'; END IF;
  -- Cash sales only; excludes opening float, expenses, withdrawals and credit collections.
  SELECT coalesce(sum(CASE WHEN payment_method='cash' THEN subtotal
    WHEN payment_method='partial' AND paid_via='cash' THEN paid_amount ELSE 0 END),0)
    INTO expected FROM public.sales WHERE shop_id=p_shop_id AND date=p_date;
  INSERT INTO public.cash_reconciliations(shop_id,date,counted_amount,expected_amount,user_id)
    VALUES(p_shop_id,p_date,round(p_counted_amount,2),round(expected,2),p_user_id)
    ON CONFLICT(shop_id,date) DO UPDATE SET counted_amount=excluded.counted_amount,
      expected_amount=excluded.expected_amount,user_id=excluded.user_id,updated_at=now()
    RETURNING * INTO saved;
  RETURN NEXT saved;
END $$;

CREATE OR REPLACE FUNCTION public.send_pharmacy_return(p_shop_id bigint,p_item_id bigint,p_quantity numeric,p_user_id bigint,p_request_id uuid)
RETURNS SETOF public.medicine_returns LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE product public.items; saved public.medicine_returns; batch record; remaining numeric; take_qty numeric; available numeric;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity::text IN ('NaN','Infinity','-Infinity') OR p_request_id IS NULL THEN RAISE EXCEPTION 'A positive return quantity and request ID are required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_user_id AND shop_id=p_shop_id AND role='owner') THEN RAISE EXCEPTION 'An owner in this pharmacy is required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  SELECT * INTO saved FROM public.medicine_returns WHERE request_id=p_request_id;
  IF FOUND THEN
    IF saved.shop_id<>p_shop_id OR saved.item_id<>p_item_id OR saved.quantity<>p_quantity THEN RAISE EXCEPTION 'Return request does not match the saved return'; END IF;
    RETURN NEXT saved; RETURN;
  END IF;
  SELECT * INTO product FROM public.items WHERE id=p_item_id AND shop_id=p_shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Medicine was not found in this pharmacy'; END IF;
  IF product.quantity<p_quantity THEN RAISE EXCEPTION 'Return quantity exceeds available stock'; END IF;
  IF nullif(trim(product.supplier_name),'') IS NULL THEN RAISE EXCEPTION 'Save a supplier before returning stock'; END IF;
  IF EXISTS(SELECT 1 FROM public.batches WHERE item_id=p_item_id AND shop_id=p_shop_id) THEN
    PERFORM 1 FROM public.batches WHERE item_id=p_item_id AND shop_id=p_shop_id ORDER BY id FOR UPDATE;
    SELECT coalesce(sum(quantity_available),0) INTO available FROM public.batches
      WHERE item_id=p_item_id AND shop_id=p_shop_id AND (nullif(product.batch_number,'') IS NULL OR batch_number=product.batch_number);
    IF available<p_quantity THEN RAISE EXCEPTION 'Batch stock is lower than the requested return; review the batch quantities'; END IF;
    remaining := p_quantity;
    FOR batch IN SELECT * FROM public.batches WHERE item_id=p_item_id AND shop_id=p_shop_id AND quantity_available>0
      AND (nullif(product.batch_number,'') IS NULL OR batch_number=product.batch_number) ORDER BY expiry_date NULLS LAST,id LOOP
      take_qty := least(remaining,batch.quantity_available);
      UPDATE public.batches SET quantity_available=quantity_available-take_qty,updated_at=now() WHERE id=batch.id;
      remaining := remaining-take_qty;
      EXIT WHEN remaining=0;
    END LOOP;
  END IF;
  UPDATE public.items SET quantity=quantity-p_quantity,updated_at=now() WHERE id=p_item_id AND shop_id=p_shop_id;
  INSERT INTO public.medicine_returns(shop_id,item_id,item_name,batch_number,supplier_name,quantity,expected_credit,user_id,request_id)
    VALUES(p_shop_id,p_item_id,coalesce(product.name,'Medicine'),product.batch_number,product.supplier_name,p_quantity,round(p_quantity*product.buy_price,2),p_user_id,p_request_id)
    RETURNING * INTO saved;
  INSERT INTO public.stock_history(shop_id,item_id,item_name,type,quantity_changed,quantity_before,quantity_after,reason,cost_per_unit,reference)
    VALUES(p_shop_id,p_item_id,saved.item_name,'adjustment',-p_quantity,product.quantity,product.quantity-p_quantity,'Sent to supplier; return credit pending',product.buy_price,'medicine-return:'||saved.id);
  RETURN NEXT saved;
END $$;

CREATE OR REPLACE FUNCTION public.credit_pharmacy_return(p_shop_id bigint,p_return_id bigint,p_received_credit numeric,p_user_id bigint)
RETURNS SETOF public.medicine_returns LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE saved public.medicine_returns;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_user_id AND shop_id=p_shop_id AND role='owner') THEN RAISE EXCEPTION 'An owner in this pharmacy is required'; END IF;
  IF p_received_credit IS NULL OR p_received_credit<0 OR p_received_credit::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Enter a valid received credit amount'; END IF;
  SELECT * INTO saved FROM public.medicine_returns WHERE id=p_return_id AND shop_id=p_shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Return was not found'; END IF;
  IF saved.status='credited' THEN RAISE EXCEPTION 'Supplier credit is already recorded'; END IF;
  UPDATE public.medicine_returns SET status='credited',received_credit=round(p_received_credit,2),user_id=p_user_id,updated_at=now()
    WHERE id=saved.id RETURNING * INTO saved;
  RETURN NEXT saved;
END $$;

-- Safe activity summaries only. Never copy passwords, tokens, full customer rows or sale notes.
CREATE OR REPLACE FUNCTION public.log_pharmacy_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE row_data jsonb; previous jsonb; summary jsonb; actor bigint;
BEGIN
  IF TG_OP='DELETE' THEN row_data:=to_jsonb(OLD); ELSE row_data:=to_jsonb(NEW); END IF;
  IF TG_OP='UPDATE' THEN previous:=to_jsonb(OLD); END IF;
  IF row_data->>'shop_id' IS NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.shops WHERE id=(row_data->>'shop_id')::bigint) THEN RETURN NULL; END IF;
  summary:=jsonb_strip_nulls(jsonb_build_object('name',coalesce(row_data->>'name',row_data->>'item_name',row_data->>'username'),
    'quantity',row_data->'quantity','subtotal',row_data->'subtotal','status',row_data->'status','counted_amount',row_data->'counted_amount'));
  IF TG_TABLE_NAME IN ('cash_reconciliations','medicine_returns') THEN actor:=(row_data->>'user_id')::bigint; END IF;
  INSERT INTO public.audit_logs(shop_id,user_id,action,table_name,record_id,old_data,new_data)
    VALUES((row_data->>'shop_id')::bigint,actor,CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END,
      TG_TABLE_NAME,row_data->>'id',NULL,summary);
  RETURN NULL;
END $$;
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['items','sales','credit_customers','users','cash_reconciliations','medicine_returns'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=format('public.%I',table_name)::regclass AND tgname='medishop_activity') THEN
      EXECUTE format('CREATE TRIGGER medishop_activity AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_pharmacy_activity()',table_name);
    END IF;
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.reconcile_pharmacy_cash(bigint,date,numeric,bigint), public.send_pharmacy_return(bigint,bigint,numeric,bigint,uuid), public.credit_pharmacy_return(bigint,bigint,numeric,bigint) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
