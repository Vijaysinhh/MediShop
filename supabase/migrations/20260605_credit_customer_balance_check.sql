-- Add CHECK constraint to ensure credit_customers.balance is never negative
ALTER TABLE credit_customers
ADD CONSTRAINT credit_customers_balance_check
CHECK (balance >= 0);
