-- Phase 1: Fix admin access to wallet_transactions
CREATE POLICY "Admins can view all wallet transactions"
ON wallet_transactions FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Phase 2: Create Advanced Escrow System Tables

-- 1. Escrow Accounts - One per rental, holds funds safely
CREATE TABLE escrow_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL UNIQUE REFERENCES rentals(id) ON DELETE CASCADE,
  total_amount NUMERIC NOT NULL,
  platform_fee NUMERIC NOT NULL DEFAULT 0,
  owner_payout NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'releasing', 'released', 'refunded', 'disputed', 'frozen')),
  held_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  auto_release_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Escrow Transactions - Audit trail of all escrow movements
CREATE TABLE escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_account_id UUID NOT NULL REFERENCES escrow_accounts(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'release', 'refund', 'fee_deduction', 'partial_release')),
  amount NUMERIC NOT NULL,
  from_wallet_id UUID REFERENCES wallets(id),
  to_wallet_id UUID REFERENCES wallets(id),
  executed_by UUID REFERENCES profiles(id),
  notes TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Disputes - Handle rental conflicts
CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  filed_by UUID NOT NULL REFERENCES profiles(id),
  filed_against UUID NOT NULL REFERENCES profiles(id),
  dispute_type TEXT NOT NULL CHECK (dispute_type IN ('damage', 'late_return', 'item_condition', 'payment', 'no_show', 'other')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  evidence_urls TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'escalated', 'closed')),
  resolution_notes TEXT,
  resolution_amount NUMERIC,
  resolution_split JSONB, -- e.g., {"owner": 0.7, "renter": 0.3}
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Payment Milestones - For long rentals with staged releases
CREATE TABLE payment_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  escrow_account_id UUID NOT NULL REFERENCES escrow_accounts(id) ON DELETE CASCADE,
  milestone_number INTEGER NOT NULL,
  percentage NUMERIC NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  amount NUMERIC NOT NULL,
  scheduled_release_date DATE NOT NULL,
  actual_release_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'released', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(rental_id, milestone_number)
);

-- 5. Refund Policies - Define cancellation terms
CREATE TABLE refund_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  policy_type TEXT NOT NULL DEFAULT 'standard' CHECK (policy_type IN ('standard', 'flexible', 'strict', 'custom')),
  cancellation_window_hours INTEGER NOT NULL DEFAULT 48,
  refund_percentage NUMERIC NOT NULL DEFAULT 100 CHECK (refund_percentage >= 0 AND refund_percentage <= 100),
  compensation_percentage NUMERIC DEFAULT 0 CHECK (compensation_percentage >= 0 AND compensation_percentage <= 100),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_escrow_accounts_rental ON escrow_accounts(rental_id);
CREATE INDEX idx_escrow_accounts_status ON escrow_accounts(status);
CREATE INDEX idx_escrow_accounts_auto_release ON escrow_accounts(auto_release_at) WHERE status = 'held';
CREATE INDEX idx_escrow_transactions_escrow ON escrow_transactions(escrow_account_id);
CREATE INDEX idx_disputes_rental ON disputes(rental_id);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_payment_milestones_rental ON payment_milestones(rental_id);
CREATE INDEX idx_refund_policies_item ON refund_policies(item_id);

-- Enable RLS
ALTER TABLE escrow_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_policies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Escrow Accounts
CREATE POLICY "Users can view their rental escrows"
ON escrow_accounts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM rentals
    WHERE rentals.id = escrow_accounts.rental_id
    AND (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
  )
);

CREATE POLICY "Admins can view all escrow accounts"
ON escrow_accounts FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage escrow accounts"
ON escrow_accounts FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for Escrow Transactions
CREATE POLICY "Users can view their escrow transactions"
ON escrow_transactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM escrow_accounts ea
    JOIN rentals r ON r.id = ea.rental_id
    WHERE ea.id = escrow_transactions.escrow_account_id
    AND (r.renter_id = auth.uid() OR r.owner_id = auth.uid())
  )
);

CREATE POLICY "Admins can view all escrow transactions"
ON escrow_transactions FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for Disputes
CREATE POLICY "Users can view their disputes"
ON disputes FOR SELECT
TO authenticated
USING (filed_by = auth.uid() OR filed_against = auth.uid());

CREATE POLICY "Users can file disputes"
ON disputes FOR INSERT
TO authenticated
WITH CHECK (filed_by = auth.uid());

CREATE POLICY "Users can update their own disputes"
ON disputes FOR UPDATE
TO authenticated
USING (filed_by = auth.uid() AND status = 'open');

CREATE POLICY "Admins can manage all disputes"
ON disputes FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for Payment Milestones
CREATE POLICY "Users can view their rental milestones"
ON payment_milestones FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM rentals
    WHERE rentals.id = payment_milestones.rental_id
    AND (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
  )
);

CREATE POLICY "Admins can manage milestones"
ON payment_milestones FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for Refund Policies
CREATE POLICY "Anyone can view active refund policies"
ON refund_policies FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Item owners can manage their refund policies"
ON refund_policies FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM items
    WHERE items.id = refund_policies.item_id
    AND items.owner_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all refund policies"
ON refund_policies FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_escrow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_escrow_accounts_updated_at
BEFORE UPDATE ON escrow_accounts
FOR EACH ROW
EXECUTE FUNCTION update_escrow_updated_at();

CREATE TRIGGER update_disputes_updated_at
BEFORE UPDATE ON disputes
FOR EACH ROW
EXECUTE FUNCTION update_escrow_updated_at();

CREATE TRIGGER update_refund_policies_updated_at
BEFORE UPDATE ON refund_policies
FOR EACH ROW
EXECUTE FUNCTION update_escrow_updated_at();

-- Function to check if escrow is eligible for auto-release
CREATE OR REPLACE FUNCTION check_escrow_auto_release()
RETURNS TABLE(escrow_id UUID, rental_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT ea.id, ea.rental_id
  FROM escrow_accounts ea
  JOIN rentals r ON r.id = ea.rental_id
  WHERE ea.status = 'held'
    AND ea.auto_release_at <= NOW()
    AND r.status = 'completed'
    AND r.owner_confirmed_completion = true
    AND r.renter_confirmed_completion = true
    AND NOT EXISTS (
      SELECT 1 FROM disputes d
      WHERE d.rental_id = ea.rental_id
      AND d.status IN ('open', 'investigating')
    )
    AND NOT EXISTS (
      SELECT 1 FROM fraud_alerts fa
      JOIN rentals r2 ON r2.renter_id = fa.user_id OR r2.owner_id = fa.user_id
      WHERE r2.id = ea.rental_id
      AND fa.status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to freeze escrow when dispute is filed
CREATE OR REPLACE FUNCTION freeze_escrow_on_dispute()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE escrow_accounts
  SET status = 'disputed',
      updated_at = NOW()
  WHERE rental_id = NEW.rental_id
    AND status = 'held';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER freeze_escrow_on_dispute_trigger
AFTER INSERT ON disputes
FOR EACH ROW
EXECUTE FUNCTION freeze_escrow_on_dispute();

-- Insert default refund policies for existing items
INSERT INTO platform_settings (key, value, description)
VALUES 
  ('escrow_grace_period_hours', '24', 'Hours to wait after rental completion before auto-releasing escrow'),
  ('enable_auto_escrow_release', 'true', 'Enable automatic escrow release for completed rentals')
ON CONFLICT (key) DO NOTHING;