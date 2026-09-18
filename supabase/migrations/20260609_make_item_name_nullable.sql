-- Make item name nullable to allow only Marathi name
ALTER TABLE items ALTER COLUMN name DROP NOT NULL;
