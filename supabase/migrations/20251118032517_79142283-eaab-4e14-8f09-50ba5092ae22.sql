-- Phase 1: Create Platform Settings System
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO platform_settings (key, value, description) VALUES
  ('platform_fee_rate', '0.10', 'Platform commission rate (0.10 = 10%)'),
  ('min_withdrawal_amount', '10.00', 'Minimum withdrawal amount in RM'),
  ('max_withdrawal_amount', '50000.00', 'Maximum withdrawal amount in RM'),
  ('withdrawal_processing_fee', '0.00', 'Fixed fee for processing withdrawals'),
  ('min_topup_amount', '1.00', 'Minimum top-up amount in RM'),
  ('max_topup_amount', '10000.00', 'Maximum top-up amount in RM'),
  ('auto_approve_threshold', '500.00', 'Auto-approve withdrawals below this amount'),
  ('min_account_age_days', '30', 'Minimum account age for auto-approval')
ON CONFLICT (key) DO NOTHING;

-- RLS Policies
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON platform_settings
  FOR SELECT USING (true);

CREATE POLICY "Only admins can update settings" ON platform_settings
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- Function to get setting value
CREATE OR REPLACE FUNCTION get_platform_setting(setting_key TEXT)
RETURNS NUMERIC AS $$
DECLARE
  setting_value NUMERIC;
BEGIN
  SELECT (value::text)::numeric INTO setting_value
  FROM platform_settings
  WHERE key = setting_key;
  
  RETURN COALESCE(setting_value, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Phase 2: Enhanced Withdrawal System with Risk Detection
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN DEFAULT false;
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS notes TEXT;

-- Function to calculate withdrawal risk score
CREATE OR REPLACE FUNCTION calculate_withdrawal_risk(p_user_id UUID, p_amount NUMERIC)
RETURNS INTEGER AS $$
DECLARE
  v_risk_score INTEGER := 0;
  v_account_age_days INTEGER;
  v_wallet_balance NUMERIC;
  v_recent_withdrawals INTEGER;
  v_pending_rentals INTEGER;
  v_fraud_alerts INTEGER;
BEGIN
  -- Check account age
  SELECT EXTRACT(DAY FROM NOW() - created_at) INTO v_account_age_days
  FROM profiles WHERE id = p_user_id;
  
  IF v_account_age_days < 30 THEN
    v_risk_score := v_risk_score + 30;
  END IF;
  
  -- Check wallet balance
  SELECT balance INTO v_wallet_balance
  FROM wallets WHERE user_id = p_user_id;
  
  IF p_amount > (v_wallet_balance * 0.8) THEN
    v_risk_score := v_risk_score + 25;
  END IF;
  
  -- Check recent withdrawal patterns
  SELECT COUNT(*) INTO v_recent_withdrawals
  FROM withdrawal_requests
  WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '24 hours';
    
  IF v_recent_withdrawals > 2 THEN
    v_risk_score := v_risk_score + 20;
  END IF;
  
  -- Check pending rentals
  SELECT COUNT(*) INTO v_pending_rentals
  FROM rentals
  WHERE (renter_id = p_user_id OR owner_id = p_user_id)
    AND status IN ('active', 'pending');
    
  IF v_pending_rentals > 0 THEN
    v_risk_score := v_risk_score + 15;
  END IF;
  
  -- Check fraud alerts
  SELECT COUNT(*) INTO v_fraud_alerts
  FROM fraud_alerts
  WHERE user_id = p_user_id
    AND status = 'pending';
    
  IF v_fraud_alerts > 0 THEN
    v_risk_score := v_risk_score + 50;
  END IF;
  
  RETURN v_risk_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to calculate risk on withdrawal creation
CREATE OR REPLACE FUNCTION set_withdrawal_risk_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.risk_score := calculate_withdrawal_risk(NEW.user_id, NEW.amount);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_set_withdrawal_risk
  BEFORE INSERT ON withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_withdrawal_risk_score();

-- Phase 3: Withdrawal Notifications
CREATE OR REPLACE FUNCTION notify_withdrawal_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      NEW.user_id,
      CASE 
        WHEN NEW.status = 'approved' THEN 'payment_received'
        WHEN NEW.status = 'rejected' THEN 'rental_rejected'
        ELSE 'rental_approved'
      END,
      CASE 
        WHEN NEW.status = 'approved' THEN 'Withdrawal Approved!'
        WHEN NEW.status = 'rejected' THEN 'Withdrawal Rejected'
        WHEN NEW.status = 'processing' THEN 'Withdrawal Processing'
        ELSE 'Withdrawal Updated'
      END,
      CASE 
        WHEN NEW.status = 'approved' THEN 'Your withdrawal of RM ' || NEW.amount || ' has been approved and will be transferred within 1-3 business days.'
        WHEN NEW.status = 'rejected' THEN 'Your withdrawal request was rejected. ' || COALESCE('Reason: ' || NEW.rejection_reason, 'Please contact support for details.')
        WHEN NEW.status = 'processing' THEN 'Your withdrawal of RM ' || NEW.amount || ' is being processed.'
        ELSE 'Your withdrawal status has been updated to: ' || NEW.status
      END,
      '/wallet'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_withdrawal_notification
  AFTER UPDATE ON withdrawal_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_withdrawal_status_change();

-- Phase 4: Auto-approval function
CREATE OR REPLACE FUNCTION auto_process_safe_withdrawals()
RETURNS INTEGER AS $$
DECLARE
  v_processed_count INTEGER := 0;
  v_auto_threshold NUMERIC;
  v_min_age_days INTEGER;
BEGIN
  -- Get settings
  SELECT get_platform_setting('auto_approve_threshold') INTO v_auto_threshold;
  SELECT get_platform_setting('min_account_age_days') INTO v_min_age_days;
  
  -- Auto-approve low-risk withdrawals
  WITH approved AS (
    UPDATE withdrawal_requests wr
    SET 
      status = 'approved',
      processed_at = NOW(),
      auto_approved = true
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
    RETURNING *
  )
  SELECT COUNT(*) INTO v_processed_count FROM approved;
  
  RETURN v_processed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;