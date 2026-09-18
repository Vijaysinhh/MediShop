-- Create Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  shop_name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Categories table
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Units table (kg, g, liter, ml, pcs, etc)
CREATE TABLE units (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_form TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Items table
CREATE TABLE items (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  base_unit_id INTEGER NOT NULL REFERENCES units(id),
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  low_stock_limit DECIMAL(10,2) NOT NULL DEFAULT 0,
  wholesale_cost DECIMAL(10,2) NOT NULL,
  wholesale_quantity DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Price Tiers table (multi-level pricing)
CREATE TABLE price_tiers (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity DECIMAL(10,2) NOT NULL,
  unit_id INTEGER NOT NULL REFERENCES units(id),
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX idx_items_user_id ON items(user_id);
CREATE INDEX idx_items_category_id ON items(category_id);
CREATE INDEX idx_price_tiers_item_id ON price_tiers(item_id);
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_units_user_id ON units(user_id);


