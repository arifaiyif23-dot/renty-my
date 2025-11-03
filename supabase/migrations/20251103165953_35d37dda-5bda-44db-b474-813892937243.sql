-- Phase 2: Payment System Improvements - Transaction Rollback & Promo Security

-- Add idempotency_key index for faster duplicate checks
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_idempotency_key 
ON public.wallet_transactions(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Create function for atomic wallet deduction with rollback
CREATE OR REPLACE FUNCTION public.deduct_wallet_balance(
  p_user_id UUID,
  p_amount NUMERIC,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_existing_tx UUID;
BEGIN
  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_tx
    FROM wallet_transactions
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;
    
    IF v_existing_tx IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'duplicate', true,
        'transaction_id', v_existing_tx
      );
    END IF;
  END IF;

  -- Get wallet with row lock
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Check sufficient balance
  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Deduct balance
  v_new_balance := v_current_balance - p_amount;
  
  UPDATE wallets
  SET balance = v_new_balance, updated_at = NOW()
  WHERE id = v_wallet_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'wallet_id', v_wallet_id,
    'new_balance', v_new_balance,
    'duplicate', false
  );
END;
$$;

-- Create function to refund wallet (for rollback scenarios)
CREATE OR REPLACE FUNCTION public.refund_wallet_balance(
  p_user_id UUID,
  p_amount NUMERIC,
  p_reason TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  UPDATE wallets
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;
  
  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;
  
  RETURN v_new_balance;
END;
$$;

-- Add unique constraint for promo code usage (prevent double redemption)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_promo_usage_unique 
ON public.user_promo_usage(user_id, promo_code_id);

-- Add rate limiting table for promo code attempts
CREATE TABLE IF NOT EXISTS public.promo_attempt_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  promo_code TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_attempt_log_user_time 
ON public.promo_attempt_log(user_id, created_at DESC);

-- Enable RLS on promo_attempt_log
ALTER TABLE public.promo_attempt_log ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own promo attempts"
ON public.promo_attempt_log
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service can insert promo attempts"
ON public.promo_attempt_log
FOR INSERT
WITH CHECK (true);

-- Function to check promo code rate limit
CREATE OR REPLACE FUNCTION public.check_promo_rate_limit(
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_count INTEGER;
BEGIN
  -- Count attempts in last 5 minutes
  SELECT COUNT(*) INTO v_attempt_count
  FROM promo_attempt_log
  WHERE user_id = p_user_id
  AND created_at > NOW() - INTERVAL '5 minutes';
  
  -- Allow max 5 attempts per 5 minutes
  RETURN v_attempt_count < 5;
END;
$$;

-- Enable Realtime for wallet_transactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions;