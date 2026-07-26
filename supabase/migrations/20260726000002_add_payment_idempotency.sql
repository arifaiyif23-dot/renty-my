-- Add idempotency_key to payments table for safe retry
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_payments_idempotency_key
ON public.payments(idempotency_key)
WHERE idempotency_key IS NOT NULL;
