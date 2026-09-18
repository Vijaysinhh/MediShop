-- Seed default units for the first user
-- This script will be run after user registration to populate common units

INSERT INTO units (user_id, name, short_form) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Kilogram', 'kg'),
  ('00000000-0000-0000-0000-000000000001', 'Gram', 'g'),
  ('00000000-0000-0000-0000-000000000001', 'Liter', 'l'),
  ('00000000-0000-0000-0000-000000000001', 'Milliliter', 'ml'),
  ('00000000-0000-0000-0000-000000000001', 'Piece', 'pcs'),
  ('00000000-0000-0000-0000-000000000001', 'Dozen', 'dz'),
  ('00000000-0000-0000-0000-000000000001', 'Box', 'box'),
  ('00000000-0000-0000-0000-000000000001', 'Pack', 'pack')
ON CONFLICT DO NOTHING;

-- Seed default categories
INSERT INTO categories (user_id, name, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Cereals', 'Rice, wheat, flour, etc.'),
  ('00000000-0000-0000-0000-000000000001', 'Spices', 'All types of spices'),
  ('00000000-0000-0000-0000-000000000001', 'Pulses', 'Daal, beans, legumes'),
  ('00000000-0000-0000-0000-000000000001', 'Oils', 'Cooking oils, ghee'),
  ('00000000-0000-0000-0000-000000000001', 'Beverages', 'Tea, coffee, drinks'),
  ('00000000-0000-0000-0000-000000000001', 'Snacks', 'Biscuits, namkeen, etc.'),
  ('00000000-0000-0000-0000-000000000001', 'Dairy', 'Milk, butter, cheese'),
  ('00000000-0000-0000-0000-000000000001', 'Vegetables', 'Fresh vegetables')
ON CONFLICT DO NOTHING;
