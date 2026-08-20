-- ============================================================================
-- Fasa A (Audit 2026-08-19): fix the remaining lint/runtime errors.
--
-- 1. cancel_no_show_rentals / expire_stale_bookings: inside a RETURNS TABLE fn
--    the OUT parameter `rental_id` shadows the payments.rental_id column, so
--    `WHERE rental_id = v_rec.id` is ambiguous (42702) at runtime. Qualify with
--    a table alias.
-- 2. hash_ic_number: `digest()` lives in the extensions schema (pgcrypto), but
--    the function sets search_path = public only -> "function digest does not
--    exist". Add extensions to search_path + explicit 'sha256'::text cast.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. cancel_no_show_rentals: alias the payments subquery
-- ----------------------------------------------------------------------------
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
      SELECT p.id, p.total_amount INTO v_payment
        FROM public.payments p
       WHERE p.rental_id = v_rec.id AND p.status = 'paid'
       ORDER BY p.paid_at DESC NULLS LAST, p.created_at DESC
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

-- ----------------------------------------------------------------------------
-- 2. expire_stale_bookings: alias the payments subquery
-- ----------------------------------------------------------------------------
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
      SELECT p.id, p.total_amount INTO v_payment
        FROM public.payments p
       WHERE p.rental_id = v_rec.id AND p.status = 'paid'
       ORDER BY p.paid_at DESC NULLS LAST, p.created_at DESC
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
-- 3. hash_ic_number: search_path must include extensions for pgcrypto.digest
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hash_ic_number(ic text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = extensions, public
AS $$
DECLARE
  v_salt text;
BEGIN
  v_salt := COALESCE(current_setting('app.settings.ic_hash_salt', true), 'r3nty_ic_salt_2026_a8f7b2c9d1e4');
  RETURN encode(digest(ic || v_salt, 'sha256'::text), 'hex');
END;
$$;

COMMENT ON FUNCTION public.hash_ic_number IS 'Hashes an IC number using SHA-256 with salt from app.settings.ic_hash_salt. Set via: ALTER DATABASE postgres SET app.settings.ic_hash_salt TO ''your-secret-salt'';';