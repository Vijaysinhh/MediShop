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
