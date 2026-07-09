-- Re-create payment_locks table and acquire_payment_lock function
-- (were dropped by the payment system removal migration, needed for race condition prevention)

CREATE TABLE IF NOT EXISTS public.payment_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL UNIQUE REFERENCES public.rentals(id) ON DELETE CASCADE,
  locked_by UUID NOT NULL,
  locked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'released', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_locks_rental_id ON public.payment_locks(rental_id);
CREATE INDEX IF NOT EXISTS idx_payment_locks_expires_at ON public.payment_locks(expires_at);

ALTER TABLE public.payment_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage payment locks"
ON public.payment_locks
FOR ALL
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.cleanup_expired_payment_locks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE payment_locks
  SET status = 'expired'
  WHERE status = 'locked' 
  AND expires_at < NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.acquire_payment_lock(
  p_rental_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lock_acquired BOOLEAN := FALSE;
BEGIN
  PERFORM cleanup_expired_payment_locks();
  
  INSERT INTO payment_locks (rental_id, locked_by, expires_at)
  VALUES (p_rental_id, p_user_id, NOW() + INTERVAL '5 minutes')
  ON CONFLICT (rental_id) DO NOTHING
  RETURNING TRUE INTO lock_acquired;
  
  RETURN COALESCE(lock_acquired, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_payment_lock(p_rental_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE payment_locks
  SET status = 'released'
  WHERE rental_id = p_rental_id;
END;
$$;
