-- Add deduct_wallet_balance_withdrawal function for withdrawal-specific rate limiting
CREATE OR REPLACE FUNCTION deduct_wallet_balance_withdrawal(
  p_user_id UUID,
  p_amount NUMERIC,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
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

  -- Check withdrawal-specific rate limits
  v_limit_check := check_wallet_operation_limit(p_user_id, p_amount, 'withdrawal');
  
  IF NOT (v_limit_check->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Transaction limit exceeded',
      'reason', v_limit_check->>'reason',
      'details', v_limit_check
    );
  END IF;

  -- Get wallet and lock for update
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Insufficient balance',
      'current_balance', v_current_balance,
      'required', p_amount
    );
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update calculate_withdrawal_risk to be more comprehensive
CREATE OR REPLACE FUNCTION calculate_withdrawal_risk(p_user_id UUID, p_amount NUMERIC)
RETURNS INTEGER AS $$
DECLARE
  v_risk_score INTEGER := 0;
  v_account_age_days INTEGER;
  v_wallet_balance NUMERIC;
  v_recent_withdrawals INTEGER;
  v_pending_rentals INTEGER;
  v_fraud_alerts INTEGER;
  v_total_transactions INTEGER;
BEGIN
  -- Check account age (30% weight if new)
  SELECT EXTRACT(DAY FROM NOW() - created_at) INTO v_account_age_days
  FROM profiles WHERE id = p_user_id;
  
  IF v_account_age_days < 7 THEN
    v_risk_score := v_risk_score + 50;
  ELSIF v_account_age_days < 30 THEN
    v_risk_score := v_risk_score + 30;
  END IF;
  
  -- Check wallet balance ratio (25% weight)
  SELECT balance INTO v_wallet_balance
  FROM wallets WHERE user_id = p_user_id;
  
  IF p_amount > (v_wallet_balance * 0.9) THEN
    v_risk_score := v_risk_score + 30;
  ELSIF p_amount > (v_wallet_balance * 0.8) THEN
    v_risk_score := v_risk_score + 25;
  END IF;
  
  -- Check recent withdrawal patterns (20% weight)
  SELECT COUNT(*) INTO v_recent_withdrawals
  FROM withdrawal_requests
  WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '24 hours';
    
  IF v_recent_withdrawals >= 3 THEN
    v_risk_score := v_risk_score + 30;
  ELSIF v_recent_withdrawals >= 2 THEN
    v_risk_score := v_risk_score + 20;
  END IF;
  
  -- Check pending rentals (15% weight)
  SELECT COUNT(*) INTO v_pending_rentals
  FROM rentals
  WHERE (renter_id = p_user_id OR owner_id = p_user_id)
    AND status IN ('active', 'pending');
    
  IF v_pending_rentals > 3 THEN
    v_risk_score := v_risk_score + 20;
  ELSIF v_pending_rentals > 0 THEN
    v_risk_score := v_risk_score + 15;
  END IF;
  
  -- Check fraud alerts (CRITICAL - 50% weight)
  SELECT COUNT(*) INTO v_fraud_alerts
  FROM fraud_alerts
  WHERE user_id = p_user_id
    AND status = 'pending';
    
  IF v_fraud_alerts > 0 THEN
    v_risk_score := v_risk_score + 50;
  END IF;
  
  -- Check transaction history (low activity = higher risk)
  SELECT COUNT(*) INTO v_total_transactions
  FROM wallet_transactions wt
  JOIN wallets w ON wt.wallet_id = w.id
  WHERE w.user_id = p_user_id;
  
  IF v_total_transactions < 3 THEN
    v_risk_score := v_risk_score + 20;
  END IF;
  
  RETURN LEAST(v_risk_score, 100); -- Cap at 100
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update auto_process_safe_withdrawals to use configurable thresholds
CREATE OR REPLACE FUNCTION auto_process_safe_withdrawals()
RETURNS INTEGER AS $$
DECLARE
  v_processed_count INTEGER := 0;
  v_auto_threshold NUMERIC;
  v_min_age_days INTEGER;
BEGIN
  -- Get settings with defaults
  SELECT COALESCE(get_platform_setting('auto_approve_threshold'), 500) INTO v_auto_threshold;
  SELECT COALESCE(get_platform_setting('min_account_age_days')::INTEGER, 30) INTO v_min_age_days;
  
  -- Auto-approve low-risk withdrawals
  WITH approved AS (
    UPDATE withdrawal_requests wr
    SET 
      status = 'approved',
      processed_at = NOW(),
      auto_approved = true,
      notes = 'Auto-approved by system (low risk)'
    WHERE wr.status = 'pending'
      AND wr.risk_score < 30
      AND wr.amount < v_auto_threshold
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = wr.user_id
          AND p.is_verified = true
          AND p.created_at < NOW() - (v_min_age_days || ' days')::INTERVAL
      )
      AND NOT EXISTS (
        SELECT 1 FROM fraud_alerts fa
        WHERE fa.user_id = wr.user_id
          AND fa.status = 'pending'
      )
      AND EXISTS (
        SELECT 1 FROM wallets w
        WHERE w.user_id = wr.user_id
          AND w.balance >= wr.amount + COALESCE(get_platform_setting('withdrawal_processing_fee'), 0)
      )
    RETURNING *
  )
  SELECT COUNT(*) INTO v_processed_count FROM approved;
  
  RETURN v_processed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;