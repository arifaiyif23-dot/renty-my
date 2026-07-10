-- Wire compute_trust_score via PostgreSQL triggers
-- Why triggers over cron:
--   1. Immediate — triggers run in the same transaction, no polling delay
--   2. Transactional — if trigger fails the entire op rolls back, ensuring consistency
--   3. No external dependency — works even if edge functions / pg_cron are down
--   4. Performance — compiled C, no scheduler overhead

-- Fix latent bug in compute_trust_score: SELECT INTO omitted `id` but v_profile.id was referenced
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
  v_score INTEGER := 0;
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
    RETURN 0;
  END IF;

  -- Base score: 20 points for having an account
  v_score := 20;

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

-- Helper trigger function that recomputes trust_score for a given user
CREATE OR REPLACE FUNCTION public.refresh_trust_score()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_new_score INTEGER;
BEGIN
  -- Determine which user to update based on the triggering table
  CASE TG_TABLE_NAME
    WHEN 'rentals' THEN
      IF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
        v_user_id := NEW.owner_id;
      ELSE
        RETURN NULL;
      END IF;
    WHEN 'reviews' THEN
      v_user_id := NEW.reviewee_id;
    WHEN 'verification_requests' THEN
      IF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
        v_user_id := NEW.user_id;
      ELSE
        RETURN NULL;
      END IF;
    WHEN 'profiles' THEN
      IF TG_OP = 'UPDATE' AND (OLD.is_suspended IS DISTINCT FROM NEW.is_suspended) THEN
        v_user_id := NEW.id;
      ELSE
        RETURN NULL;
      END IF;
    ELSE
      RETURN NULL;
  END CASE;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_new_score := public.compute_trust_score(v_user_id);

  UPDATE public.profiles
  SET trust_score = v_new_score,
      total_rentals_completed = (SELECT COUNT(*) FROM public.rentals WHERE owner_id = v_user_id AND status = 'completed'),
      total_reviews_received = (SELECT COUNT(*) FROM public.reviews WHERE reviewee_id = v_user_id)
  WHERE id = v_user_id;

  RETURN NULL; -- trigger function result unused
END;
$$;

-- 1. Trigger on rentals: when status becomes 'completed'
DROP TRIGGER IF EXISTS trg_refresh_trust_score_on_rental ON public.rentals;
CREATE TRIGGER trg_refresh_trust_score_on_rental
  AFTER UPDATE OF status ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_trust_score();

-- 2. Trigger on reviews: after a new review is inserted
DROP TRIGGER IF EXISTS trg_refresh_trust_score_on_review ON public.reviews;
CREATE TRIGGER trg_refresh_trust_score_on_review
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_trust_score();

-- 3. Trigger on verification_requests: when status becomes 'approved'
DROP TRIGGER IF EXISTS trg_refresh_trust_score_on_verification ON public.verification_requests;
CREATE TRIGGER trg_refresh_trust_score_on_verification
  AFTER UPDATE OF status ON public.verification_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_trust_score();

-- 4. Trigger on profiles: when suspension status changes
DROP TRIGGER IF EXISTS trg_refresh_trust_score_on_suspension ON public.profiles;
CREATE TRIGGER trg_refresh_trust_score_on_suspension
  AFTER UPDATE OF is_suspended ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_trust_score();

-- Also update total_rentals_completed / total_reviews_received for existing users
UPDATE public.profiles
SET
  total_rentals_completed = (SELECT COUNT(*) FROM public.rentals WHERE owner_id = profiles.id AND status = 'completed'),
  total_reviews_received = (SELECT COUNT(*) FROM public.reviews WHERE reviewee_id = profiles.id),
  trust_score = public.compute_trust_score(id);
