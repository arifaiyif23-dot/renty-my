-- Security & Trust Improvements
-- 1. Rental-evidence bucket: restrict to rental participants
-- 2. Profiles public view: ensure it only exposes safe columns
-- 3. Trust score computation function

-- 1. Fix rental-evidence storage bucket RLS
-- Drop permissive policies
DROP POLICY IF EXISTS "Users can upload rental evidence" ON storage.objects;
DROP POLICY IF EXISTS "Users can view rental evidence" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their rental evidence" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their rental evidence" ON storage.objects;

-- Recreate with rental participant checks
CREATE POLICY "Users can upload rental evidence"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rental-evidence'
    AND EXISTS (
      SELECT 1 FROM rentals
      WHERE rentals.id::text = (storage.foldername(name))[2]
        AND (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
    )
  );

CREATE POLICY "Users can view rental evidence"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'rental-evidence'
    AND EXISTS (
      SELECT 1 FROM rentals
      WHERE rentals.id::text = (storage.foldername(name))[2]
        AND (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
    )
  );

CREATE POLICY "Users can update their rental evidence"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'rental-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND EXISTS (
      SELECT 1 FROM rentals
      WHERE rentals.id::text = (storage.foldername(name))[2]
        AND (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
    )
  );

CREATE POLICY "Users can delete their rental evidence"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'rental-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND EXISTS (
      SELECT 1 FROM rentals
      WHERE rentals.id::text = (storage.foldername(name))[2]
        AND (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
    )
  );

-- 2. Recreate profiles_public view with safe columns
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles AS
SELECT
  id,
  full_name,
  avatar_url,
  is_verified,
  verification_level,
  trust_score
FROM public.profiles;

-- 3. Trust score computation function
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
  v_response_rate NUMERIC;
  v_score INTEGER := 0;
BEGIN
  SELECT
    verification_level,
    is_verified,
    is_suspended,
    created_at
  INTO v_profile
  FROM profiles
  WHERE id = p_user_id;

  IF v_profile.id IS NULL THEN
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
