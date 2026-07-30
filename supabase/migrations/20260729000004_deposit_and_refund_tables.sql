-- Phase 5: Deposit & Refund System
-- SOP: BOOKING_PAYMENT_SYSTEM.md §3 — Deposit Lifecycle
-- 5.1: deposits table
-- 5.4: refunds table
-- 5.5: PARTIALLY_REFUNDED payment status

-- ============================================
-- 5.1: Deposits Table
-- ============================================
CREATE TABLE IF NOT EXISTS deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID REFERENCES public.rentals(id) ON DELETE CASCADE NOT NULL,
  payer_id UUID REFERENCES public.profiles(id) NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'held', 'released', 'partially_deducted', 'fully_deducted')),
  released_at TIMESTAMPTZ,
  deduction_amount NUMERIC(10,2),
  deduction_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rental participants can view deposits"
  ON deposits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rentals
      WHERE rentals.id = deposits.rental_id
        AND (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
    )
  );

CREATE POLICY "Admins can view all deposits"
  ON deposits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "System can manage deposits"
  ON deposits FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_deposits_rental_id ON deposits(rental_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);

-- ============================================
-- 5.4: Refunds Table
-- ============================================
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
  rental_id UUID REFERENCES public.rentals(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processed_by UUID REFERENCES public.profiles(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own refunds"
  ON refunds FOR SELECT
  USING (
    auth.uid() = processed_by OR
    EXISTS (
      SELECT 1 FROM payments
      WHERE payments.id = refunds.payment_id
        AND payments.payer_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all refunds"
  ON refunds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "System can manage refunds"
  ON refunds FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_rental_id ON refunds(rental_id);

-- ============================================
-- 5.5: Add PARTIALLY_REFUNDED to payments status
-- ============================================
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('draft', 'pending', 'completed', 'failed', 'refunded', 'partially_refunded'));

-- Also add deposit_amount to payments for tracking
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2) DEFAULT 0;

-- Add deposit_amount to rentals for tracking
ALTER TABLE rentals
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2) DEFAULT 0;

-- ============================================
-- Trigger: Create deposit record on payment completion
-- ============================================
CREATE OR REPLACE FUNCTION public.create_deposit_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_deposit_amount NUMERIC(10,2);
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    -- Get deposit amount from the associated rental's item
    SELECT COALESCE(i.deposit_amount, 0) INTO v_deposit_amount
    FROM items i
    JOIN rentals r ON r.item_id = i.id
    WHERE r.id = NEW.rental_id;

    IF v_deposit_amount > 0 THEN
      INSERT INTO deposits (rental_id, payer_id, amount, status)
      VALUES (NEW.rental_id, NEW.payer_id, v_deposit_amount, 'held');
    END IF;

    -- Record deposit_amount on the payment for reference
    IF NEW.deposit_amount IS DISTINCT FROM v_deposit_amount THEN
      UPDATE payments SET deposit_amount = v_deposit_amount WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_deposit_on_payment ON public.payments;
CREATE TRIGGER trg_create_deposit_on_payment
  AFTER UPDATE OF status ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_deposit_on_payment();

-- ============================================
-- Trigger: Auto-release deposit when rental is completed
-- ============================================
CREATE OR REPLACE FUNCTION public.release_deposit_on_rental_complete()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    UPDATE deposits
    SET status = 'released',
        released_at = NOW()
    WHERE rental_id = NEW.id
      AND status = 'held';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_deposit_on_rental_complete ON public.rentals;
CREATE TRIGGER trg_release_deposit_on_rental_complete
  AFTER UPDATE OF status ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.release_deposit_on_rental_complete();
