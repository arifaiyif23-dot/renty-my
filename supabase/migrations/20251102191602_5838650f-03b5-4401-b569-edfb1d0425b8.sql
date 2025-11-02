-- Phase 1: Critical Security Fixes

-- 1.1 Add idempotency_key to wallet_transactions
ALTER TABLE public.wallet_transactions 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_idempotency 
ON public.wallet_transactions(idempotency_key);

-- 1.2 Fix SECURITY DEFINER views by converting to RLS policies
DROP VIEW IF EXISTS public.promo_codes_public CASCADE;
DROP VIEW IF EXISTS public.listing_analytics_summary CASCADE;
DROP VIEW IF EXISTS public.rental_payment_status CASCADE;

-- 1.3 Fix search_path on existing functions
CREATE OR REPLACE FUNCTION public.increment_wallet_balance(p_user_id uuid, p_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  new_balance numeric;
BEGIN
  UPDATE wallets
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING balance INTO new_balance;
  
  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;
  
  RETURN new_balance;
END;
$function$;

-- 1.4 Add minimum withdrawal validation
ALTER TABLE public.withdrawal_requests
ADD CONSTRAINT check_minimum_withdrawal 
CHECK (amount >= 50);

-- 1.5 Add payment timeout handling
ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Trigger to set expiration on pending transactions
CREATE OR REPLACE FUNCTION public.set_transaction_expiration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    NEW.expires_at = NOW() + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_transaction_expiration
BEFORE INSERT ON public.wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION public.set_transaction_expiration();

-- 1.6 Payment hold review table for admin workflow
CREATE TABLE IF NOT EXISTS public.payment_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_hold_id UUID NOT NULL REFERENCES public.payment_holds(id) ON DELETE CASCADE,
  reviewed_by UUID REFERENCES auth.users(id),
  review_status TEXT NOT NULL CHECK (review_status IN ('approved', 'rejected', 'flagged')),
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payment_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payment reviews"
ON public.payment_reviews
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- 1.7 Add admin action audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
ON public.admin_audit_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert audit logs"
ON public.admin_audit_log
FOR INSERT
WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_id ON public.admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON public.admin_audit_log(created_at DESC);