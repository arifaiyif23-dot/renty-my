-- Phase 2.1: Fix trust_score default to 50 per SOP
-- SOP: TRUST_VERIFICATION_SECURITY.md "New users start at 50/100"
-- Master Manual §5: "New verified users start at 50/100"

-- 1. Change column default from 0 to 50
ALTER TABLE profiles
  ALTER COLUMN trust_score SET DEFAULT 50;

-- 2. Update compute_trust_score base from 20 to 50
CREATE OR REPLACE FUNCTION public.compute_trust_score(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_rentals_completed INTEGER;
  v_reviews_received INTEGER;
  v_avg_rating NUMERIC;
  v_account_age_days INTEGER;
  v_score INTEGER := 50;
BEGIN
  SELECT
    id,
    verification_level,
    is_verified,
    is_suspended,
    created_at
  INTO v_profile
  FROM profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN 50;
  END IF;

  -- Verification level bonus (max 25 points)
  CASE v_profile.verification_level
    WHEN 'email' THEN v_score := v_score + 5;
    WHEN 'basic' THEN v_score := v_score + 15;
    WHEN 'kyc' THEN v_score := v_score + 25;
    WHEN 'premium' THEN v_score := v_score + 25;
    ELSE NULL;
  END CASE;

  -- If is_verified (old field) but no level set, give partial credit
  IF v_profile.verification_level IS NULL AND v_profile.is_verified THEN
    v_score := v_score + 15;
  END IF;

  -- Completed rentals (max 20 points: 1 per rental, cap at 20)
  SELECT COUNT(*) INTO v_rentals_completed
  FROM rentals
  WHERE owner_id = p_user_id AND status = 'completed';

  v_score := v_score + LEAST(v_rentals_completed, 20);

  -- Reviews received (max 15 points: 1 per review, cap at 15)
  SELECT COUNT(*), COALESCE(AVG(rating), 0)
  INTO v_reviews_received, v_avg_rating
  FROM reviews
  WHERE reviewee_id = p_user_id;

  v_score := v_score + LEAST(v_reviews_received, 15);

  -- Average rating bonus (max 10 points: above 4.0 gets bonus)
  IF v_avg_rating >= 4.5 THEN
    v_score := v_score + 10;
  ELSIF v_avg_rating >= 4.0 THEN
    v_score := v_score + 5;
  ELSIF v_avg_rating >= 3.0 THEN
    v_score := v_score + 2;
  END IF;

  -- Account age bonus (max 10 points: 1 per month, cap at 10)
  v_account_age_days := EXTRACT(DAY FROM (NOW() - v_profile.created_at));
  v_score := v_score + LEAST(FLOOR(v_account_age_days / 30)::INTEGER, 10);

  -- Suspension penalty
  IF v_profile.is_suspended THEN
    v_score := GREATEST(0, v_score - 50);
  END IF;

  -- Clamp to 0-100
  RETURN GREATEST(0, LEAST(v_score, 100));
END;
$$;

-- 3. Backfill existing profiles: new users with no history get 50
UPDATE profiles
SET trust_score = public.compute_trust_score(id)
WHERE trust_score IS DISTINCT FROM public.compute_trust_score(id);
