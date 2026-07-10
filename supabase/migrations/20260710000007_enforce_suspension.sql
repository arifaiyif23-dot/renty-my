-- Helper RPC: check if a user is suspended, raise exception if so
CREATE OR REPLACE FUNCTION public.check_user_not_suspended(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_suspended BOOLEAN;
  v_reason TEXT;
BEGIN
  SELECT is_suspended, suspension_reason
  INTO v_suspended, v_reason
  FROM profiles
  WHERE id = p_user_id;

  IF v_suspended THEN
    RAISE EXCEPTION 'ACCOUNT_SUSPENDED: %', COALESCE(v_reason, 'Your account has been suspended. Contact support for assistance.')
    USING HINT = 'SUSPENDED';
  END IF;

  RETURN true;
END;
$$;

-- Index for fast suspension checks
CREATE INDEX IF NOT EXISTS idx_profiles_suspended ON profiles(is_suspended) WHERE is_suspended = true;
