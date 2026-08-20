-- ============================================================================
-- Fasa A (Audit 2026-08-19): fix report_vendor_no_show.
--
-- The old function checked `status != 'paid'` which is NOT a valid value of the
-- rental_status enum (SOP) -> runtime error 22P02 -> vendor no-show reporting
-- ALWAYS failed (confirm-handover calls it when status = 'confirmed').
--
-- Fix: accept status 'confirmed' (SOP handover stage), cancel the rental and
-- create a FULL refund payout back to the renter (vendor no-show = not renter's
-- fault), and penalize the vendor trust score.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.report_vendor_no_show(
  p_rental_id UUID,
  p_renter_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rental RECORD;
  v_payment RECORD;
BEGIN
  SELECT id, renter_id, owner_id, status, start_date
    INTO v_rental
    FROM public.rentals
   WHERE id = p_rental_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rental not found');
  END IF;

  IF v_rental.renter_id != p_renter_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the renter can report vendor no-show');
  END IF;

  -- SOP: handover runs from 'confirmed' (owner approved + payment done).
  IF v_rental.status != 'confirmed' THEN
    RETURN jsonb_build_object('success', false, 'error', format('Rental cannot be cancelled. Current status: %s', v_rental.status));
  END IF;

  IF v_rental.start_date > CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Start date has not passed yet');
  END IF;

  UPDATE public.rentals
     SET status = 'cancelled',
         updated_at = NOW()
   WHERE id = p_rental_id AND status = 'confirmed';

  -- Vendor no-show: full refund back to the renter.
  SELECT id, total_amount INTO v_payment
    FROM public.payments
   WHERE rental_id = p_rental_id AND status = 'paid'
   ORDER BY paid_at DESC NULLS LAST, created_at DESC
   LIMIT 1;
  IF FOUND THEN
    INSERT INTO public.payouts (
      owner_id, payment_id, rental_id, rental_amount, platform_fee, payout_amount, status, held_reason
    ) VALUES (
      v_rental.renter_id, v_payment.id, p_rental_id, 0, 0,
      ROUND(COALESCE(v_payment.total_amount, 0)::numeric, 2),
      'pending', 'Vendor no-show - full refund'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Penalize vendor trust score
  UPDATE public.profiles
     SET trust_score = GREATEST(0, COALESCE(trust_score, 50) - 15),
         updated_at = NOW()
   WHERE id = v_rental.owner_id;

  RETURN jsonb_build_object(
    'success', true,
    'action', 'vendor_no_show',
    'rental_id', p_rental_id,
    'owner_id', v_rental.owner_id
  );
END;
$$;
