-- Fix 1: Create atomic wallet balance update function to prevent race conditions
CREATE OR REPLACE FUNCTION increment_wallet_balance(
  p_user_id uuid,
  p_amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Fix 2: Add status column to wallet_transactions for idempotency
ALTER TABLE wallet_transactions 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'
CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_wallet_tx_status 
ON wallet_transactions(toyyibpay_transaction_id, status)
WHERE status = 'completed';

-- Fix 3: Fix wallet RLS policies - remove overly permissive policy
DROP POLICY IF EXISTS "System can manage wallets" ON wallets;

-- Only service role can manage wallets (for edge functions)
CREATE POLICY "Service role can manage wallets"
ON wallets FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- No direct wallet updates from authenticated users
CREATE POLICY "No direct wallet updates"
ON wallets FOR UPDATE
TO authenticated
USING (false);

-- No direct wallet inserts from authenticated users
CREATE POLICY "No direct wallet creation"
ON wallets FOR INSERT
TO authenticated
WITH CHECK (false);

-- No direct wallet deletes
CREATE POLICY "No direct wallet deletion"
ON wallets FOR DELETE
TO authenticated
USING (false);