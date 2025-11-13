-- Payment Security Enhancements: Rate Limiting and Transaction Limits

-- 1. Create rate limiting table for wallet operations
CREATE TABLE IF NOT EXISTS public.wallet_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_rate_limits_user_time 
ON public.wallet_rate_limits(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_rate_limits_ip_time 
ON public.wallet_rate_limits(ip_address, created_at DESC);

ALTER TABLE public.wallet_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rate limit records"
ON public.wallet_rate_limits
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service can insert rate limit records"
ON public.wallet_rate_limits
FOR INSERT
WITH CHECK (true);

-- 2. Create comprehensive rate limiting function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_ip_address INET,
  p_action TEXT,
  p_max_attempts INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
  v_cutoff_time timestamptz;
BEGIN
  v_cutoff_time := NOW() - (p_window_seconds || ' seconds')::interval;
  
  SELECT COUNT(*) INTO v_count
  FROM rate_limits
  WHERE action = p_action
    AND created_at > v_cutoff_time
    AND (
      (p_user_id IS NOT NULL AND user_id = p_user_id) OR
      (p_ip_address IS NOT NULL AND ip_address = p_ip_address)
    );
  
  INSERT INTO rate_limits (user_id, ip_address, action)
  VALUES (p_user_id, p_ip_address, p_action);
  
  RETURN v_count < p_max_attempts;
END;
$$;

-- 3. Create function to check wallet operation limits
CREATE OR REPLACE FUNCTION public.check_wallet_operation_limit(
  p_user_id UUID,
  p_amount NUMERIC,
  p_operation_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_daily_total NUMERIC;
  v_max_single_transaction NUMERIC := 10000.00;
  v_max_daily_total NUMERIC := 50000.00;
BEGIN
  IF p_amount > v_max_single_transaction THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'exceeds_single_transaction_limit',
      'max_amount', v_max_single_transaction
    );
  END IF;
  
  SELECT COALESCE(SUM(amount), 0) INTO v_daily_total
  FROM wallet_transactions wt
  JOIN wallets w ON wt.wallet_id = w.id
  WHERE w.user_id = p_user_id
    AND wt.type = p_operation_type
    AND wt.created_at > NOW() - INTERVAL '24 hours'
    AND wt.status = 'completed';
  
  IF (v_daily_total + p_amount) > v_max_daily_total THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'exceeds_daily_limit',
      'current_daily_total', v_daily_total,
      'max_daily_total', v_max_daily_total
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'current_daily_total', v_daily_total
  );
END;
$$;

-- 4. Enhance increment_wallet_balance with limits
CREATE OR REPLACE FUNCTION public.increment_wallet_balance(
  p_user_id uuid, 
  p_amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_balance numeric;
  v_limit_check jsonb;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  
  v_limit_check := check_wallet_operation_limit(p_user_id, p_amount, 'top_up');
  
  IF NOT (v_limit_check->>'allowed')::boolean THEN
    RAISE EXCEPTION 'Transaction limit exceeded: %', v_limit_check->>'reason';
  END IF;
  
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
$$;

-- 5. Enhance deduct_wallet_balance with fraud detection
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
  v_limit_check JSONB;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  
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

  v_limit_check := check_wallet_operation_limit(p_user_id, p_amount, 'rental_payment');
  
  IF NOT (v_limit_check->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Transaction limit exceeded',
      'details', v_limit_check
    );
  END IF;

  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
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

-- 6. Create cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$;