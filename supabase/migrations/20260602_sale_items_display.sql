-- Run in Supabase SQL editor if sale_items already exists without display columns
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS display_quantity VARCHAR(255);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS unit_short_form VARCHAR(50);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS price_tier_id BIGINT;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS pack_count NUMERIC;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS price_tier_quantity NUMERIC;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS price_tier_unit_short_form VARCHAR(50);
