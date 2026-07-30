-- Sprint 1: Return Flow + Overdue Escalation
-- Gaps: #5 (overdue escalation), #10 (disputed item_status)

-- ============================================
-- Gap #10: Add 'disputed' to item_status ENUM
-- ============================================
ALTER TYPE item_status ADD VALUE IF NOT EXISTS 'disputed';

-- ============================================
-- Update item status transition guard for disputed
-- ============================================
CREATE OR REPLACE FUNCTION public.check_item_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT (
      (OLD.status = 'created' AND NEW.status IN ('under_review')) OR
      (OLD.status = 'under_review' AND NEW.status IN ('available', 'maintenance', 'created')) OR
      (OLD.status = 'available' AND NEW.status IN ('paused', 'reserved')) OR
      (OLD.status = 'paused' AND NEW.status IN ('available')) OR
      (OLD.status = 'reserved' AND NEW.status IN ('pickup_pending', 'available')) OR
      (OLD.status = 'pickup_pending' AND NEW.status IN ('active_rental', 'available')) OR
      (OLD.status = 'active_rental' AND NEW.status IN ('return_pending', 'maintenance', 'overdue')) OR
      (OLD.status = 'return_pending' AND NEW.status IN ('inspection_pending')) OR
      (OLD.status = 'inspection_pending' AND NEW.status IN ('available', 'maintenance', 'damaged', 'disputed')) OR
      (OLD.status = 'disputed' AND NEW.status IN ('available', 'maintenance', 'damaged')) OR
      (OLD.status = 'maintenance' AND NEW.status IN ('available', 'damaged')) OR
      (OLD.status = 'damaged' AND NEW.status IN ('maintenance', 'available')) OR
      (NEW.status = 'lost')
    ) THEN
      RAISE EXCEPTION 'Invalid item status transition: % → %', OLD.status, NEW.status
        USING HINT = format('Item %s cannot transition from %s to %s', NEW.id, OLD.status, NEW.status);
    END IF;

    INSERT INTO item_status_history (item_id, old_status, new_status, changed_by, reason, metadata)
    VALUES (
      NEW.id, OLD.status, NEW.status, auth.uid(), NEW.status,
      jsonb_build_object('trigger', TG_NAME, 'timestamp', NOW())
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================
-- Update complete_inspection() to support 'disputed' result
-- ============================================
CREATE OR REPLACE FUNCTION public.complete_inspection(
  p_item_id UUID,
  p_result TEXT,
  p_claim_type TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_penalty_amount NUMERIC(10,2) DEFAULT 0,
  p_evidence_urls TEXT[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_current_status item_status;
  v_rental_id UUID;
  v_owner_id UUID;
BEGIN
  SELECT status, owner_id INTO v_current_status, v_owner_id
  FROM items WHERE id = p_item_id;

  IF v_current_status IS DISTINCT FROM 'inspection_pending' AND v_current_status IS DISTINCT FROM 'disputed' THEN
    RAISE EXCEPTION 'Item is not in inspection_pending or disputed status (current: %)', v_current_status;
  END IF;

  SELECT id INTO v_rental_id
  FROM rentals
  WHERE item_id = p_item_id AND status IN ('completed', 'disputed')
  ORDER BY updated_at DESC LIMIT 1;

  CASE p_result
    WHEN 'available' THEN
      UPDATE items SET status = 'available' WHERE id = p_item_id;
    WHEN 'maintenance' THEN
      UPDATE items SET status = 'maintenance' WHERE id = p_item_id;
    WHEN 'damaged' THEN
      UPDATE items SET status = 'damaged' WHERE id = p_item_id;
      IF p_claim_type IS NOT NULL AND p_description IS NOT NULL THEN
        INSERT INTO damage_claims (rental_id, item_id, filed_by, claim_type, description, penalty_amount, evidence_urls)
        VALUES (v_rental_id, p_item_id, v_owner_id, p_claim_type, p_description, p_penalty_amount, p_evidence_urls);
      END IF;
    ELSE
      RAISE EXCEPTION 'Invalid inspection result: % (valid: available, maintenance, damaged)', p_result;
  END CASE;

  RETURN jsonb_build_object('success', true, 'new_status', p_result, 'rental_id', v_rental_id);
END;
$$;

-- ============================================
-- Gap #5: Overdue escalation — escalate_overdue_rentals()
-- Flow: active → overdue (existing) → limited_access (new)
-- ============================================
CREATE OR REPLACE FUNCTION public.escalate_overdue_rentals()
RETURNS TABLE(rental_id UUID, renter_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_grace_hours NUMERIC(10,2);
  v_overdue_threshold INTERVAL;
BEGIN
  SELECT COALESCE(
    (SELECT setting_value::NUMERIC FROM platform_settings
     WHERE setting_key = 'overdue_escalation_hours'),
    24
  ) INTO v_grace_hours;

  v_overdue_threshold := (v_grace_hours || ' hours')::INTERVAL;

  RETURN QUERY
  WITH overdue_rentals AS (
    SELECT r.id, r.renter_id, r.owner_id
    FROM rentals r
    WHERE r.status = 'overdue'
      AND r.end_date < NOW() - v_overdue_threshold
      AND NOT EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = r.renter_id
          AND p.restriction_level IN ('limited_access', 'suspended')
          AND p.restricted_at > r.updated_at
      )
  )
  UPDATE profiles p
  SET
    restriction_level = 'limited_access',
    restriction_reason = FORMAT('Overdue rental %s — no communication for %s hours after due date', overdue_rentals.id, v_grace_hours),
    restricted_at = NOW(),
    updated_at = NOW()
  FROM overdue_rentals
  WHERE p.id = overdue_rentals.renter_id
  RETURNING overdue_rentals.id, overdue_rentals.renter_id;
END;
$$;

-- ============================================
-- Gap #2: Vendor no-show handling
-- Renter can report vendor no-show after start_date has passed
-- ============================================
CREATE OR REPLACE FUNCTION public.report_vendor_no_show(
  p_rental_id UUID,
  p_renter_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rental RECORD;
  v_owner_id UUID;
BEGIN
  SELECT id, renter_id, owner_id, status, start_date
  INTO v_rental
  FROM rentals
  WHERE id = p_rental_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rental not found');
  END IF;

  IF v_rental.renter_id != p_renter_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the renter can report vendor no-show');
  END IF;

  IF v_rental.status != 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', format('Rental cannot be cancelled. Current status: %s', v_rental.status));
  END IF;

  IF v_rental.start_date > NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Start date has not passed yet');
  END IF;

  -- Cancel the rental
  UPDATE rentals
  SET status = 'cancelled'
  WHERE id = p_rental_id AND status = 'paid';

  -- Penalize vendor trust score
  UPDATE profiles
  SET trust_score = GREATEST(0, COALESCE(trust_score, 50) - 15),
      updated_at = NOW()
  WHERE id = v_rental.owner_id;

  -- Refund renter flag: set a note via notification and rely on existing refund mechanism

  RETURN jsonb_build_object(
    'success', true,
    'action', 'vendor_no_show',
    'rental_id', p_rental_id,
    'owner_id', v_rental.owner_id
  );
END;
$$;

-- ============================================
-- Update cancel_no_show_rentals to differentiate fault
-- ============================================
CREATE OR REPLACE FUNCTION public.cancel_no_show_rentals()
RETURNS TABLE(rental_id UUID, item_id UUID, renter_id UUID, no_show_type TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Renter no-show: no handover photos uploaded, renter never showed
  RETURN QUERY
  WITH cancelled AS (
    UPDATE public.rentals
    SET status = 'cancelled'
    WHERE status = 'paid'
      AND start_date + INTERVAL '24 hours' < NOW()
      AND actual_start_at IS NULL
      AND (handover_photos IS NULL OR array_length(handover_photos, 1) IS NULL)
    RETURNING id, item_id, renter_id
  )
  -- Penalize renter trust score for no-show
  UPDATE profiles p
  SET trust_score = GREATEST(0, COALESCE(p.trust_score, 50) - 10),
      updated_at = NOW()
  FROM cancelled
  WHERE p.id = cancelled.renter_id
  RETURNING cancelled.id, cancelled.item_id, cancelled.renter_id, 'renter_no_show'::TEXT;

  -- Vendor no-show: photos were uploaded (renter showed up) but owner didn't confirm
  RETURN QUERY
  WITH cancelled AS (
    UPDATE public.rentals
    SET status = 'cancelled'
    WHERE status = 'paid'
      AND start_date + INTERVAL '24 hours' < NOW()
      AND actual_start_at IS NULL
      AND handover_photos IS NOT NULL
      AND array_length(handover_photos, 1) > 0
    RETURNING id, item_id, renter_id, owner_id
  )
  -- Penalize vendor trust score for no-show
  UPDATE profiles p
  SET trust_score = GREATEST(0, COALESCE(p.trust_score, 50) - 15),
      updated_at = NOW()
  FROM cancelled
  WHERE p.id = cancelled.owner_id
  RETURNING cancelled.id, cancelled.item_id, cancelled.renter_id, 'vendor_no_show'::TEXT;
END;
$$;
