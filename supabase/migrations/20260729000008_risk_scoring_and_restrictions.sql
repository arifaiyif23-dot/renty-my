-- Phase 10: Risk Scoring & Restriction Levels
-- SOP: TRUST_VERIFICATION_SECURITY.md §2-3, ADMIN_OPERATION.md

-- ============================================
-- 10.5: Transaction risk scoring
-- ============================================
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';

ALTER TABLE rentals
  ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'low'
    CHECK (risk_level IN ('low', 'medium', 'high'));

-- Compute risk level for a rental based on user profile + booking patterns
CREATE OR REPLACE FUNCTION public.compute_rental_risk(p_renter_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_trust_score NUMERIC;
  v_verification_level TEXT;
  v_total_rentals INTEGER;
  v_completed_rentals INTEGER;
  v_cancelled_rentals INTEGER;
  v_account_age_days INTEGER;
  v_has_fraud_alert BOOLEAN;
  v_risk_score NUMERIC := 0;
BEGIN
  -- Get user profile info
  SELECT trust_score, verification_level, EXTRACT(DAY FROM (NOW() - created_at))::INTEGER
  INTO v_trust_score, v_verification_level, v_account_age_days
  FROM profiles WHERE id = p_renter_id;

  v_trust_score := COALESCE(v_trust_score, 0);
  v_account_age_days := COALESCE(v_account_age_days, 0);

  -- Count rentals
  SELECT COUNT(*) INTO v_total_rentals FROM rentals WHERE renter_id = p_renter_id;
  SELECT COUNT(*) INTO v_completed_rentals FROM rentals WHERE renter_id = p_renter_id AND status = 'completed';
  SELECT COUNT(*) INTO v_cancelled_rentals FROM rentals WHERE renter_id = p_renter_id AND status = 'cancelled';

  -- Check for fraud alerts
  SELECT EXISTS(SELECT 1 FROM fraud_alerts WHERE user_id = p_renter_id AND status = 'pending')
  INTO v_has_fraud_alert;

  -- Scoring
  IF v_trust_score < 30 THEN v_risk_score := v_risk_score + 30; END IF;
  IF v_trust_score < 50 THEN v_risk_score := v_risk_score + 15; END IF;
  IF COALESCE(v_verification_level, 'unverified') IN ('unverified', 'email') THEN v_risk_score := v_risk_score + 20; END IF;
  IF v_account_age_days < 7 THEN v_risk_score := v_risk_score + 15; END IF;
  IF v_cancelled_rentals > 2 THEN v_risk_score := v_risk_score + 20; END IF;
  IF v_completed_rentals = 0 AND v_total_rentals > 0 THEN v_risk_score := v_risk_score + 10; END IF;
  IF v_has_fraud_alert THEN v_risk_score := v_risk_score + 40; END IF;

  -- Clamp
  v_risk_score := GREATEST(0, LEAST(v_risk_score, 100));

  RETURN CASE
    WHEN v_risk_score >= 60 THEN 'high'
    WHEN v_risk_score >= 30 THEN 'medium'
    ELSE 'low'
  END;
END;
$$;

-- Trigger: auto-set risk_level on new rentals
CREATE OR REPLACE FUNCTION public.set_rental_risk_level()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.risk_level := public.compute_rental_risk(NEW.renter_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_rental_risk_level ON public.rentals;
CREATE TRIGGER trg_set_rental_risk_level
  BEFORE INSERT ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_rental_risk_level();

-- ============================================
-- 10.6: Restriction levels (beyond suspension)
-- ============================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS restriction_level TEXT DEFAULT 'none'
    CHECK (restriction_level IN ('none', 'warning', 'limited_access', 'suspended')),
  ADD COLUMN IF NOT EXISTS restriction_reason TEXT,
  ADD COLUMN IF NOT EXISTS restricted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS restricted_by UUID REFERENCES public.profiles(id);

-- Migrate existing suspension data to restriction_level
UPDATE profiles
SET restriction_level = 'suspended'
WHERE is_suspended = true AND restriction_level = 'none';

-- Keep is_suspended as a view-compatible flag for legacy checks
CREATE OR REPLACE FUNCTION public.check_user_restricted(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_level TEXT;
  v_reason TEXT;
BEGIN
  SELECT restriction_level, restriction_reason INTO v_level, v_reason
  FROM profiles WHERE id = p_user_id;

  IF v_level = 'suspended' THEN
    RAISE EXCEPTION 'ACCOUNT_SUSPENDED: Your account has been suspended. Contact support. Reason: %', COALESCE(v_reason, 'No reason provided');
  END IF;

  IF v_level = 'limited_access' THEN
    RAISE EXCEPTION 'ACCOUNT_LIMITED: Your account has limited access. Reason: %', COALESCE(v_reason, 'No reason provided');
  END IF;

  RETURN v_level;
END;
$$;

-- Replace check_user_not_suspended to use new restriction system
CREATE OR REPLACE FUNCTION public.check_user_not_suspended(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_level TEXT;
  v_reason TEXT;
BEGIN
  SELECT restriction_level, restriction_reason INTO v_level, v_reason
  FROM profiles WHERE id = p_user_id;

  IF v_level IN ('suspended', 'limited_access') THEN
    RAISE EXCEPTION 'ACCOUNT_SUSPENDED: Your account has been suspended. Contact support. Reason: %', COALESCE(v_reason, 'No reason provided');
  END IF;
END;
$$;

-- Sync is_suspended for backward compatibility
CREATE OR REPLACE FUNCTION public.sync_restriction_level()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.restriction_level IS DISTINCT FROM OLD.restriction_level THEN
    NEW.is_suspended := NEW.restriction_level IN ('suspended', 'limited_access');
    IF NEW.restriction_level != 'none' AND OLD.restriction_level = 'none' THEN
      NEW.restricted_at := NOW();
    END IF;
    IF NEW.restriction_level = 'none' THEN
      NEW.restricted_at := NULL;
      NEW.restriction_reason := NULL;
      NEW.restricted_by := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_restriction_level ON public.profiles;
CREATE TRIGGER trg_sync_restriction_level
  BEFORE UPDATE OF restriction_level ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_restriction_level();
