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
