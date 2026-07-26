-- ============================================================================
-- Auto-create owner payout when a rental is completed.
--
-- Previously, payouts were NEVER created automatically even though the UI
-- (Earnings.tsx) told owners "Payouts are created automatically when rentals
-- complete". Owners would never get paid unless rows were inserted by hand.
--
-- This trigger fires when a rental transitions into 'completed' and inserts a
-- 'pending' payout for the owner, using the rental's paid payment row. The
-- payout_amount is rental_amount minus the platform fee. It is idempotent:
-- one payout per (rental_id, owner) is enforced by a partial unique index.
-- ============================================================================

-- One owner payout per rental (refund payouts use owner_id = renter and are
-- distinguished by rental_amount > 0 for owner payouts).
CREATE UNIQUE INDEX IF NOT EXISTS idx_payouts_owner_rental_unique
  ON public.payouts (rental_id, owner_id)
  WHERE rental_amount > 0;

-- Prevent two open payments for the same rental (double-bill protection).
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_open_rental_unique
  ON public.payments (rental_id)
  WHERE status IN ('pending', 'paid');

CREATE OR REPLACE FUNCTION public.create_payout_on_rental_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_payout_amount NUMERIC;
BEGIN
  -- Only act on a transition INTO 'completed'.
  IF NEW.status <> 'completed' OR (OLD.status IS NOT DISTINCT FROM 'completed') THEN
    RETURN NEW;
  END IF;

  -- Find the paid payment for this rental.
  SELECT id, rental_amount, platform_fee
    INTO v_payment
  FROM public.payments
  WHERE rental_id = NEW.id
    AND status = 'paid'
  ORDER BY paid_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  -- No paid payment -> nothing to pay out.
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Owner receives rental amount minus platform fee (floor at 0).
  v_payout_amount := GREATEST(0, COALESCE(v_payment.rental_amount, 0) - COALESCE(v_payment.platform_fee, 0));

  -- Idempotent insert; do nothing if the payout already exists.
  INSERT INTO public.payouts (
    owner_id,
    payment_id,
    rental_id,
    rental_amount,
    platform_fee,
    payout_amount,
    status
  ) VALUES (
    NEW.owner_id,
    v_payment.id,
    NEW.id,
    COALESCE(v_payment.rental_amount, 0),
    COALESCE(v_payment.platform_fee, 0),
    v_payout_amount,
    'pending'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payout_on_rental_complete ON public.rentals;
CREATE TRIGGER trg_payout_on_rental_complete
  AFTER UPDATE OF status ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.create_payout_on_rental_complete();
