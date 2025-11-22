-- ============================================================================
-- SIMPLIFIED PAYMENT SYSTEM MIGRATION
-- Removes: wallets, wallet_transactions, escrow_accounts, escrow_transactions, withdrawal_requests
-- Adds: payments, owner_earnings, payouts
-- ============================================================================

-- Drop old wallet and escrow system tables
DROP TABLE IF EXISTS wallet_transactions CASCADE;
DROP TABLE IF EXISTS escrow_transactions CASCADE;
DROP TABLE IF EXISTS escrow_accounts CASCADE;
DROP TABLE IF EXISTS withdrawal_requests CASCADE;
DROP TABLE IF EXISTS wallet_rate_limits CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;

-- Drop related functions
DROP FUNCTION IF EXISTS increment_wallet_balance CASCADE;
DROP FUNCTION IF EXISTS deduct_wallet_balance CASCADE;
DROP FUNCTION IF EXISTS deduct_wallet_balance_withdrawal CASCADE;
DROP FUNCTION IF EXISTS refund_wallet_balance CASCADE;
DROP FUNCTION IF EXISTS check_wallet_operation_limit CASCADE;
DROP FUNCTION IF EXISTS check_escrow_auto_release CASCADE;
DROP FUNCTION IF EXISTS process_orphaned_rental_payment CASCADE;
DROP FUNCTION IF EXISTS update_escrow_updated_at CASCADE;
DROP FUNCTION IF EXISTS set_escrow_auto_release CASCADE;
DROP FUNCTION IF EXISTS freeze_escrow_on_dispute CASCADE;
DROP FUNCTION IF EXISTS calculate_withdrawal_risk CASCADE;
DROP FUNCTION IF EXISTS set_withdrawal_risk_score CASCADE;
DROP FUNCTION IF EXISTS notify_withdrawal_status_change CASCADE;
DROP FUNCTION IF EXISTS auto_process_safe_withdrawals CASCADE;
DROP FUNCTION IF EXISTS handle_new_wallet CASCADE;
DROP FUNCTION IF EXISTS set_transaction_completed_at CASCADE;
DROP FUNCTION IF EXISTS set_transaction_expiration CASCADE;

-- ============================================================================
-- NEW TABLE 1: PAYMENTS (replaces wallet_transactions for rental payments)
-- ============================================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID REFERENCES rentals(id) ON DELETE CASCADE NOT NULL,
  payer_id UUID NOT NULL,
  
  -- Payment amounts
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  platform_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  owner_earnings NUMERIC(10,2) NOT NULL CHECK (owner_earnings >= 0),
  
  -- ToyyibPay integration
  toyyibpay_bill_code TEXT UNIQUE,
  toyyibpay_transaction_id TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  paid_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for payments
CREATE INDEX idx_payments_rental_id ON payments(rental_id);
CREATE INDEX idx_payments_payer_id ON payments(payer_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_toyyibpay_bill_code ON payments(toyyibpay_bill_code);

-- RLS policies for payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payments"
  ON payments FOR SELECT
  USING (
    auth.uid() = payer_id OR
    EXISTS (
      SELECT 1 FROM rentals
      WHERE rentals.id = payments.rental_id
      AND rentals.owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage payments"
  ON payments FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- NEW TABLE 2: OWNER_EARNINGS (replaces escrow_accounts)
-- ============================================================================
CREATE TABLE owner_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE NOT NULL,
  rental_id UUID REFERENCES rentals(id) ON DELETE CASCADE NOT NULL,
  
  -- Earnings amount
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  
  -- Release tracking
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'released', 'disputed', 'refunded')),
  held_until DATE, -- Auto-release date (e.g., 3 days after rental ends)
  released_at TIMESTAMPTZ,
  
  -- Payout tracking
  payout_status TEXT NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending', 'processing', 'paid', 'failed')),
  payout_id UUID,
  paid_to_owner_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for owner_earnings
CREATE INDEX idx_owner_earnings_owner_id ON owner_earnings(owner_id);
CREATE INDEX idx_owner_earnings_payment_id ON owner_earnings(payment_id);
CREATE INDEX idx_owner_earnings_rental_id ON owner_earnings(rental_id);
CREATE INDEX idx_owner_earnings_status ON owner_earnings(status);
CREATE INDEX idx_owner_earnings_payout_status ON owner_earnings(payout_status);
CREATE INDEX idx_owner_earnings_held_until ON owner_earnings(held_until);

-- RLS policies for owner_earnings
ALTER TABLE owner_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their own earnings"
  ON owner_earnings FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Admins can view all earnings"
  ON owner_earnings FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage earnings"
  ON owner_earnings FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- NEW TABLE 3: PAYOUTS (replaces withdrawal_requests)
-- ============================================================================
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  
  -- Payout amount and included earnings
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  earnings_included UUID[] NOT NULL DEFAULT '{}', -- Array of owner_earnings.id
  
  -- Bank details
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder_name TEXT NOT NULL,
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'rejected')),
  toyyibpay_payout_id TEXT,
  processed_at TIMESTAMPTZ,
  
  -- Admin tracking
  processed_by UUID,
  admin_notes TEXT,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for payouts
CREATE INDEX idx_payouts_owner_id ON payouts(owner_id);
CREATE INDEX idx_payouts_status ON payouts(status);
CREATE INDEX idx_payouts_processed_by ON payouts(processed_by);

-- RLS policies for payouts
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their own payouts"
  ON payouts FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners can create payout requests"
  ON payouts FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Admins can view all payouts"
  ON payouts FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update payouts"
  ON payouts FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage payouts"
  ON payouts FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_owner_earnings_updated_at
  BEFORE UPDATE ON owner_earnings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payouts_updated_at
  BEFORE UPDATE ON payouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PLATFORM SETTINGS FOR NEW SYSTEM
-- ============================================================================

INSERT INTO platform_settings (key, value, description) VALUES
('platform_fee_percentage', '10', 'Platform fee percentage (10 = 10%)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO platform_settings (key, value, description) VALUES
('earnings_hold_days', '3', 'Days to hold earnings after rental ends before auto-release')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO platform_settings (key, value, description) VALUES
('min_payout_amount', '10', 'Minimum payout amount in RM')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO platform_settings (key, value, description) VALUES
('max_payout_amount', '10000', 'Maximum payout amount in RM')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO platform_settings (key, value, description) VALUES
('auto_payout_enabled', 'false', 'Enable automatic payouts via ToyyibPay API')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;