-- Sprint 2: Payment, Trust & Deposit
-- Gaps: #11 (PROCESSING), #20 (NOT_REQUIRED), #15 (trust events), #3 (vendor trust), #8 (penalty hourly)

-- ============================================
-- Gap #11: Add 'processing' to payments status
-- ============================================
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('draft', 'pending', 'processing', 'paid', 'completed', 'failed', 'refunded', 'partially_refunded'))
  NOT VALID;

-- ============================================
-- Gap #20: Add 'not_required' to deposits status
-- ============================================
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_status_check;
ALTER TABLE deposits ADD CONSTRAINT deposits_status_check
  CHECK (status IN ('not_required', 'pending', 'held', 'released', 'partially_deducted', 'fully_deducted'));

-- ============================================
-- Gap #15: Trust score event adjustment function + triggers
-- ============================================
CREATE OR REPLACE FUNCTION public.adjust_trust_score(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET trust_score = GREATEST(0, LEAST(100, COALESCE(trust_score, 50) + p_amount)),
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- Trigger: on rental completed (renter +2)
CREATE OR REPLACE FUNCTION public.on_rental_completed_trust()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    PERFORM adjust_trust_score(NEW.renter_id, 2, 'Rental completed');
    PERFORM adjust_trust_score(NEW.owner_id, 2, 'Rental completed');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rental_completed_trust ON rentals;
CREATE TRIGGER trg_rental_completed_trust
  AFTER UPDATE OF status ON rentals
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION public.on_rental_completed_trust();

-- Trigger: on late return (renter -3)
CREATE OR REPLACE FUNCTION public.on_late_return_trust()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.penalty_amount > 0 THEN
    PERFORM adjust_trust_score(
      (SELECT renter_id FROM rentals WHERE id = NEW.rental_id),
      -3,
      FORMAT('Late return: penalty RM%s', NEW.penalty_amount)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_late_return_trust ON late_return_records;
CREATE TRIGGER trg_late_return_trust
  AFTER INSERT ON late_return_records
  FOR EACH ROW
  EXECUTE FUNCTION public.on_late_return_trust();

-- Trigger: on damage claim (renter -10, or less if partial)
CREATE OR REPLACE FUNCTION public.on_damage_claim_trust()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    PERFORM adjust_trust_score(
      (SELECT renter_id FROM rentals WHERE id = NEW.rental_id),
      -10,
      FORMAT('Damage claim approved: %s', NEW.claim_type)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_damage_claim_trust ON damage_claims;
CREATE TRIGGER trg_damage_claim_trust
  AFTER UPDATE OF status ON damage_claims
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION public.on_damage_claim_trust();

-- ============================================
-- Gap #3: Vendor trust score
-- ============================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS vendor_trust_score INTEGER DEFAULT 50;

COMMENT ON COLUMN profiles.vendor_trust_score IS 'Separate trust score for vendors (0-100). Independent from renter trust_score.';

CREATE OR REPLACE FUNCTION public.compute_vendor_trust_score(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_score INTEGER := 50;
  v_verified BOOLEAN;
  v_rentals_completed INTEGER;
  v_cancellation_rate NUMERIC;
  v_avg_rating NUMERIC;
  v_total_rentals INTEGER;
BEGIN
  SELECT is_verified INTO v_verified FROM profiles WHERE id = p_user_id;
  IF v_verified THEN
    v_score := v_score + 15;
  END IF;

  SELECT COUNT(*) INTO v_total_rentals
  FROM rentals WHERE owner_id = p_user_id;

  SELECT COUNT(*) INTO v_rentals_completed
  FROM rentals WHERE owner_id = p_user_id AND status = 'completed';

  IF v_total_rentals > 0 THEN
    v_cancellation_rate := (SELECT COUNT(*)::NUMERIC / v_total_rentals
      FROM rentals WHERE owner_id = p_user_id AND status = 'cancelled');
    v_score := v_score - GREATEST(0, (v_cancellation_rate * 30)::INTEGER);

    v_score := v_score + LEAST(15, v_rentals_completed * 2);
  END IF;

  SELECT COALESCE(AVG(rating), 0) INTO v_avg_rating
  FROM reviews WHERE reviewee_id = p_user_id;

  IF v_avg_rating >= 4.5 THEN v_score := v_score + 10;
  ELSIF v_avg_rating >= 4.0 THEN v_score := v_score + 5;
  ELSIF v_avg_rating >= 3.0 THEN v_score := v_score + 2;
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND restriction_level = 'suspended') THEN
    v_score := v_score - 30;
  END IF;

  RETURN GREATEST(0, LEAST(100, v_score));
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_vendor_trust_score()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('completed', 'cancelled') THEN
    UPDATE profiles
    SET vendor_trust_score = compute_vendor_trust_score(NEW.owner_id),
        updated_at = NOW()
    WHERE id = NEW.owner_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_vendor_trust ON rentals;
CREATE TRIGGER trg_refresh_vendor_trust
  AFTER UPDATE OF status ON rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_vendor_trust_score();

-- ============================================
-- Gap #8: Penalty calc — hourly rate alignment with SOP
-- Current: ceil(hours/24) * (daily_price * 1.5)
-- New: chargeable_hours * (daily_price * 0.1) — approx RM10/hr for RM100/day item
-- ============================================
CREATE OR REPLACE FUNCTION public.compute_late_penalty(
  p_rental_id UUID,
  p_actual_return_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS NUMERIC(10,2)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_end_date TIMESTAMPTZ;
  v_price_per_day NUMERIC(10,2);
  v_hours_late NUMERIC(10,2);
  v_chargeable_hours NUMERIC(10,2);
  v_penalty NUMERIC(10,2);
  v_grace_period NUMERIC(10,2);
  v_hourly_rate NUMERIC(10,2);
BEGIN
  SELECT r.end_date, i.price_per_day
  INTO v_end_date, v_price_per_day
  FROM rentals r
  JOIN items i ON i.id = r.item_id
  WHERE r.id = p_rental_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(
    (SELECT setting_value::NUMERIC FROM platform_settings
     WHERE setting_key = 'late_return_grace_period_hours'),
    3
  ) INTO v_grace_period;

  -- Hourly rate = 10% of daily price (aligns with SOP: RM10/hr for RM100/day item)
  SELECT COALESCE(
    (SELECT setting_value::NUMERIC FROM platform_settings
     WHERE setting_key = 'late_return_hourly_rate_pct'),
    10
  ) INTO v_hourly_rate;
  v_hourly_rate := v_price_per_day * (v_hourly_rate / 100);

  v_hours_late := EXTRACT(EPOCH FROM (p_actual_return_date - v_end_date)) / 3600;

  IF v_hours_late <= 0 THEN
    RETURN 0;
  END IF;

  v_chargeable_hours := GREATEST(0, v_hours_late - v_grace_period);

  v_penalty := v_chargeable_hours * v_hourly_rate;

  v_penalty := ROUND(v_penalty, 2);

  INSERT INTO late_return_records (rental_id, expected_end_date, actual_return_date, hours_late, grace_period_hours, chargeable_hours, penalty_amount)
  VALUES (p_rental_id, v_end_date, p_actual_return_date, v_hours_late, v_grace_period, v_chargeable_hours, v_penalty);

  IF v_penalty > 0 THEN
    INSERT INTO penalty_records (rental_id, penalty_type, amount, description, created_by)
    VALUES (p_rental_id, 'late_return', v_penalty,
            format('Late return: %s hours late (%s chargeable after %s-hour grace). Hourly rate: %s%% of daily price (RM%s/day = RM%s/hr).',
                   ROUND(v_hours_late, 1), ROUND(v_chargeable_hours, 1), ROUND(v_grace_period, 1),
                   (SELECT COALESCE((SELECT setting_value FROM platform_settings WHERE setting_key = 'late_return_hourly_rate_pct'), '10')),
                   v_price_per_day, ROUND(v_hourly_rate, 2)),
            NULL);
  END IF;

  RETURN v_penalty;
END;
$$;
