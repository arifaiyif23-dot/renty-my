-- ============================================================================
-- Fasa A (Audit 2026-08-19): payout/refund integrity, rentals write authz,
-- payment cleanup + no-show/expiry refunds.
--
-- 1. payouts.rental_id was `NOT NULL UNIQUE` (20251123065315) so every refund
--    insert for the same rental collided with the owner payout (23505) and
--    failed silently -> renters were never refunded. Replace the unconditional
--    UNIQUE with the existing partial index idx_payouts_owner_rental_unique
--    (rental_id, owner_id) WHERE rental_amount > 0, so a refund payout
--    (owner_id = renter, rental_amount = 0) can coexist with the owner payout.
-- 2. Drop the legacy create_payout_on_payment_success trigger on payments that
--    minted a 'held' owner payout at payment time and relied on the dropped
--    release_held_payout trigger. Owner payouts are now created on completion.
-- 3. Rewrite create_payout_on_rental_complete to release any legacy held payout
--    to 'pending' (instead of ON CONFLICT, which needs a matching constraint).
-- 4. Void held/awaiting payouts when a rental is cancelled/rejected/disputed so
--    ops never pays the owner for a cancelled rental.
-- 5. REVOKE INSERT/UPDATE/DELETE on rentals from anon/authenticated. All rental
--    writes go through edge functions (service_role) + DB triggers. Closes the
--    hole where a crafted client could advance rental status without paying.
-- 6. Allow 'expired' in payments_status_check and fix cleanup_expired_payments()
--    for the SOP enum so the 5-min cron actually works again.
-- 7. cancel_no_show_rentals / expire_stale_bookings now create a full refund for
--    the renter when the rental was already paid (reserved/confirmed), and both
--    are scheduled on pg_cron (they were never scheduled before).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Drop unconditional UNIQUE on payouts.rental_id
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname INTO v_conname
    FROM pg_constraint
    WHERE conrelid = 'public.payouts'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.payouts'::regclass AND attname = 'rental_id')];
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.payouts DROP CONSTRAINT %I', v_conname);
  END IF;
END
$$;

-- Keep the partial unique index: one positive owner payout per rental.
-- Refund payouts (rental_amount = 0, owner_id = renter) are not captured.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payouts_owner_rental_unique
  ON public.payouts (rental_id, owner_id)
  WHERE rental_amount > 0;

-- ----------------------------------------------------------------------------
-- 2. Drop legacy payout-on-payment trigger + function
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS create_payout_on_payment_success ON public.payments;
DROP FUNCTION IF EXISTS public.create_payout_on_payment_success();

-- ----------------------------------------------------------------------------
-- 3. Rewrite completion payout trigger (release held -> pending, else insert)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_payout_on_rental_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_payout_amount NUMERIC;
  v_released INT;
BEGIN
  IF NEW.status <> 'completed' OR (OLD.status IS NOT DISTINCT FROM 'completed') THEN
    RETURN NEW;
  END IF;

  SELECT id, rental_amount, platform_fee
    INTO v_payment
  FROM public.payments
  WHERE rental_id = NEW.id
    AND status = 'paid'
  ORDER BY paid_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_payout_amount := GREATEST(0, COALESCE(v_payment.rental_amount, 0) - COALESCE(v_payment.platform_fee, 0));

  -- Legacy held/awaiting owner payout -> release to pending.
  UPDATE public.payouts
     SET status = 'pending',
         held_reason = NULL,
         updated_at = NOW()
   WHERE rental_id = NEW.id
     AND owner_id = NEW.owner_id
     AND status IN ('held', 'awaiting_bank_details');
  GET DIAGNOSTICS v_released = ROW_COUNT;

  IF v_released = 0 THEN
    INSERT INTO public.payouts (
      owner_id, payment_id, rental_id, rental_amount, platform_fee, payout_amount, status
    ) VALUES (
      NEW.owner_id, v_payment.id, NEW.id,
      COALESCE(v_payment.rental_amount, 0),
      COALESCE(v_payment.platform_fee, 0),
      v_payout_amount, 'pending'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payout_on_rental_complete ON public.rentals;
CREATE TRIGGER trg_payout_on_rental_complete
  AFTER UPDATE OF status ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.create_payout_on_rental_complete();

-- ----------------------------------------------------------------------------
-- 4. Void held/awaiting payouts on cancel / reject / dispute
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_held_payout_on_rental_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'rejected', 'disputed') AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.payouts
       SET status = 'cancelled',
           failure_reason = 'Rental ' || NEW.status || ' - held payout voided',
           updated_at = NOW()
     WHERE rental_id = NEW.id
       AND status IN ('held', 'awaiting_bank_details');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_void_held_payout_on_cancel ON public.rentals;
CREATE TRIGGER trg_void_held_payout_on_cancel
  AFTER UPDATE OF status ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.void_held_payout_on_rental_cancel();

-- ----------------------------------------------------------------------------
-- 5. REVOKE write on rentals from anon/authenticated (SELECT stays)
-- ----------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.rentals FROM anon, authenticated;
DROP POLICY IF EXISTS "Users can create rentals" ON public.rentals;
DROP POLICY IF EXISTS "Verified users can book rentals" ON public.rentals;
DROP POLICY IF EXISTS "Owners and renters can update rentals" ON public.rentals;

-- ----------------------------------------------------------------------------
-- 6. Allow 'expired' in payments status + fix cleanup SQL function
-- ----------------------------------------------------------------------------
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('draft', 'pending', 'processing', 'paid', 'completed', 'failed', 'refunded', 'partially_refunded', 'expired'))
  NOT VALID;
ALTER TABLE public.payments VALIDATE CONSTRAINT payments_status_check;

CREATE OR REPLACE FUNCTION public.cleanup_expired_payments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_rental_ids UUID[];
BEGIN
  -- Expire open payments (pending + draft that never got a bill).
  WITH expired AS (
    UPDATE public.payments
       SET status = 'expired',
           updated_at = NOW()
     WHERE status IN ('pending', 'draft')
       AND expires_at < NOW()
    RETURNING rental_id
  )
  SELECT COALESCE(array_agg(DISTINCT rental_id), '{}'::uuid[]) INTO v_expired_rental_ids FROM expired;

  -- Cancel affected rentals unless a payment was concurrently marked paid.
  IF cardinality(v_expired_rental_ids) > 0 THEN
    UPDATE public.rentals
       SET status = 'cancelled',
           updated_at = NOW()
     WHERE id = ANY(v_expired_rental_ids)
       AND status IN ('requested', 'payment_pending')
       AND NOT EXISTS (
         SELECT 1 FROM public.payments p
         WHERE p.rental_id = rentals.id AND p.status = 'paid'
       );
  END IF;

  -- Cancel orphaned 'requested' rentals that never got a payment row
  -- (renter abandoned checkout > 7 days).
  UPDATE public.rentals
     SET status = 'cancelled',
         updated_at = NOW()
   WHERE status = 'requested'
     AND created_at < NOW() - INTERVAL '7 days'
     AND NOT EXISTS (
       SELECT 1 FROM public.payments p
       WHERE p.rental_id = rentals.id
     );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. No-show + stale-booking cancellation with renter refunds
--    (reserved/confirmed = already paid -> full refund back to the payer)
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.cancel_no_show_rentals();
CREATE OR REPLACE FUNCTION public.cancel_no_show_rentals()
RETURNS TABLE(rental_id UUID, item_id UUID, renter_id UUID, no_show_type TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_payment RECORD;
BEGIN
  FOR v_rec IN
    SELECT r.id, r.item_id, r.renter_id
      FROM public.rentals r
     WHERE r.status = 'confirmed'
       AND (r.start_date + COALESCE(r.pickup_time, '09:00'::time))::timestamptz + INTERVAL '24 hours' < NOW()
       AND r.actual_start_at IS NULL
     LIMIT 100
  LOOP
    UPDATE public.rentals
       SET status = 'cancelled',
           updated_at = NOW()
     WHERE id = v_rec.id AND status = 'confirmed';

    IF FOUND THEN
      -- Full refund to the renter if they already paid.
      SELECT id, total_amount INTO v_payment
        FROM public.payments
       WHERE rental_id = v_rec.id AND status = 'paid'
       ORDER BY paid_at DESC NULLS LAST, created_at DESC
       LIMIT 1;
      IF FOUND THEN
        INSERT INTO public.payouts (
          owner_id, payment_id, rental_id, rental_amount, platform_fee, payout_amount, status, held_reason
        ) VALUES (
          v_rec.renter_id, v_payment.id, v_rec.id, 0, 0,
          ROUND(COALESCE(v_payment.total_amount, 0)::numeric, 2),
          'pending', 'Rental cancelled (no-show) - full refund'
        )
        ON CONFLICT DO NOTHING;
      END IF;

      rental_id := v_rec.id;
      item_id := v_rec.item_id;
      renter_id := v_rec.renter_id;
      no_show_type := 'renter_no_show';
      RETURN NEXT;
    END IF;
  END LOOP;
  RETURN;
END;
$$;

DROP FUNCTION IF EXISTS public.expire_stale_bookings();
CREATE OR REPLACE FUNCTION public.expire_stale_bookings()
RETURNS TABLE(rental_id UUID, item_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_payment RECORD;
BEGIN
  FOR v_rec IN
    SELECT r.id, r.item_id, r.renter_id,
           (r.status = 'reserved') AS was_paid
      FROM public.rentals r
     WHERE (
       (r.status = 'requested' AND r.created_at < NOW() - INTERVAL '30 minutes') OR
       (r.status = 'payment_pending' AND r.updated_at < NOW() - INTERVAL '30 minutes') OR
       (r.status = 'reserved' AND r.updated_at < NOW() - INTERVAL '48 hours')
     )
     LIMIT 100
  LOOP
    UPDATE public.rentals
       SET status = 'cancelled',
           updated_at = NOW()
     WHERE id = v_rec.id
       AND status IN ('requested', 'payment_pending', 'reserved');

    IF FOUND AND v_rec.was_paid THEN
      -- reserved = paid; auto-cancel must return the money to the payer.
      SELECT id, total_amount INTO v_payment
        FROM public.payments
       WHERE rental_id = v_rec.id AND status = 'paid'
       ORDER BY paid_at DESC NULLS LAST, created_at DESC
       LIMIT 1;
      IF FOUND THEN
        INSERT INTO public.payouts (
          owner_id, payment_id, rental_id, rental_amount, platform_fee, payout_amount, status, held_reason
        ) VALUES (
          v_rec.renter_id, v_payment.id, v_rec.id, 0, 0,
          ROUND(COALESCE(v_payment.total_amount, 0)::numeric, 2),
          'pending', 'Booking expired unconfirmed - full refund'
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;

    rental_id := v_rec.id;
    item_id := v_rec.item_id;
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;

-- ----------------------------------------------------------------------------
-- Schedule automation on pg_cron (idempotent)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-expired-payments-5min');
  PERFORM cron.unschedule('expire-stale-bookings');
  PERFORM cron.unschedule('cancel-no-show-rentals');
EXCEPTION WHEN OTHERS THEN
  NULL;
END
$$;

SELECT cron.schedule('cleanup-expired-payments-5min', '*/5 * * * *', $$SELECT public.cleanup_expired_payments();$$);
SELECT cron.schedule('expire-stale-bookings', '*/30 * * * *', $$SELECT public.expire_stale_bookings();$$);
SELECT cron.schedule('cancel-no-show-rentals', '*/30 * * * *', $$SELECT public.cancel_no_show_rentals();$$);
