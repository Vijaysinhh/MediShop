-- Add CHECK constraint to ensure items.quantity is never negative
ALTER TABLE items
ADD CONSTRAINT items_quantity_check
CHECK (quantity >= 0);
