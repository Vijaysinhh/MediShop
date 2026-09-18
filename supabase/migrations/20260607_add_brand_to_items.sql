-- Add brand columns to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS brand VARCHAR(255);
ALTER TABLE items ADD COLUMN IF NOT EXISTS brand_marathi VARCHAR(255);
