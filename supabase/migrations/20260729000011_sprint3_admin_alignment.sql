-- Sprint 3: Admin, Alignment & Pages
-- Gaps: #19 (restriction levels), #9 helpers

-- ============================================
-- Gap #19: Add temporary_suspension / permanent_suspension to restriction levels
-- SOP: WARNING → LIMITED → TEMPORARY SUSPENSION → PERMANENT BAN
-- ============================================
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_restriction_level_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_restriction_level_check
  CHECK (restriction_level IN (
    'none', 'warning', 'limited_access',
    'temporary_suspension', 'permanent_suspension', 'suspended'
  ));

-- Update check_user_not_suspended to handle new levels
DROP FUNCTION IF EXISTS public.check_user_not_suspended(UUID);
CREATE FUNCTION public.check_user_not_suspended(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_level TEXT;
BEGIN
  SELECT restriction_level INTO v_level
  FROM profiles WHERE id = p_user_id;

  IF v_level IN ('suspended', 'temporary_suspension', 'permanent_suspension', 'limited_access') THEN
    RAISE EXCEPTION 'ACCOUNT_SUSPENDED: Your account has been restricted. Contact support for details.';
  END IF;
END;
$$;

-- ============================================
-- Helper for Gap #9: Promo usage restore
-- ============================================
CREATE OR REPLACE FUNCTION public.restore_promo_usage(p_promo_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE promo_codes
  SET current_uses = GREATEST(0, current_uses - 1)
  WHERE id = p_promo_id;
END;
$$;
