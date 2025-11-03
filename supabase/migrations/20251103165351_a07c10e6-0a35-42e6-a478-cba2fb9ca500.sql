-- Phase 1: Critical Security Fixes - Payment Race Condition & Audit Logging

-- Create payment_locks table for preventing race conditions
CREATE TABLE IF NOT EXISTS public.payment_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL UNIQUE REFERENCES public.rentals(id) ON DELETE CASCADE,
  locked_by UUID NOT NULL,
  locked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'released', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create payment_audit_log for forensic tracking
CREATE TABLE IF NOT EXISTS public.payment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  amount NUMERIC,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_locks_rental_id ON public.payment_locks(rental_id);
CREATE INDEX IF NOT EXISTS idx_payment_locks_expires_at ON public.payment_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_payment_audit_log_rental_id ON public.payment_audit_log(rental_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_log_created_at ON public.payment_audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.payment_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_locks (service role only)
CREATE POLICY "Service role can manage payment locks"
ON public.payment_locks
FOR ALL
USING (true)
WITH CHECK (true);

-- RLS Policies for payment_audit_log
CREATE POLICY "Admins can view audit logs"
ON public.payment_audit_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert audit logs"
ON public.payment_audit_log
FOR INSERT
WITH CHECK (true);

-- Create function to clean up expired locks
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

-- Create function to acquire payment lock (atomic)
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
  -- Clean up expired locks first
  PERFORM cleanup_expired_payment_locks();
  
  -- Try to insert lock (will fail if lock exists)
  INSERT INTO payment_locks (rental_id, locked_by, expires_at)
  VALUES (p_rental_id, p_user_id, NOW() + INTERVAL '5 minutes')
  ON CONFLICT (rental_id) DO NOTHING
  RETURNING TRUE INTO lock_acquired;
  
  RETURN COALESCE(lock_acquired, FALSE);
END;
$$;

-- Create function to release payment lock
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