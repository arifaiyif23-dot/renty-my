-- Fix operator precedence bug in check_rate_limit_enhanced
-- The missing parentheses around the OR clause meant AND bound tighter,
-- bypassing action/attempted_at filters when IP matched.

CREATE OR REPLACE FUNCTION public.check_rate_limit_enhanced(
  p_user_id UUID DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_max_attempts INT DEFAULT 5,
  p_window_minutes INT DEFAULT 15
) RETURNS TABLE(allowed BOOLEAN, remaining INT, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cutoff_time TIMESTAMPTZ;
  v_attempts INT;
BEGIN
  v_cutoff_time := NOW() - (p_window_minutes * INTERVAL '1 minute');

  IF p_user_id IS NULL AND p_ip_address IS NULL THEN
    RETURN QUERY SELECT true::BOOLEAN, p_max_attempts, NOW() + (p_window_minutes * INTERVAL '1 minute');
    RETURN;
  END IF;

  SELECT COUNT(*)::INT INTO v_attempts
  FROM public.failed_login_attempts
  WHERE action = COALESCE(p_action, 'unknown')
    AND attempted_at > v_cutoff_time
    AND ((p_user_id IS NOT NULL AND user_id = p_user_id)
      OR (p_ip_address IS NOT NULL AND ip_address = p_ip_address));

  RETURN QUERY SELECT
    (v_attempts < p_max_attempts)::BOOLEAN,
    GREATEST(0, p_max_attempts - v_attempts)::INT,
    v_cutoff_time + (p_window_minutes * INTERVAL '1 minute');
END;
$$;
