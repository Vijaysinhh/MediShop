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
