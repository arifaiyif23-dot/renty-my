-- ============================================================================
-- Fasa B (Audit 2026-08-19): atomic check-and-record rate limiter for edge fns.
--
-- check_rate_limit_enhanced (login path) is check-only and reads
-- failed_login_attempts. This adds a generic per-user/per-IP limiter backed by
-- the existing rate_limits table (service-role-only since Fasa A) that both
-- checks the window and records the attempt in one SECURITY DEFINER call.
-- Edge functions use this via supabase/functions/_shared/ratelimit.ts.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_rate_limit_track(
  p_user_id uuid DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_max_attempts int DEFAULT 30,
  p_window_minutes int DEFAULT 10
) RETURNS TABLE(allowed boolean, remaining int, reset_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz;
  v_attempts int;
BEGIN
  IF p_user_id IS NULL AND p_ip_address IS NULL THEN
    RETURN QUERY SELECT true::boolean, p_max_attempts::int,
      now() + make_interval(mins => p_window_minutes);
    RETURN;
  END IF;

  v_cutoff := now() - make_interval(mins => p_window_minutes);

  SELECT count(*)::int INTO v_attempts
  FROM public.rate_limits
  WHERE action = COALESCE(p_action, 'unknown')
    AND created_at > v_cutoff
    AND (
      (p_user_id IS NOT NULL AND user_id = p_user_id)
      OR (p_ip_address IS NOT NULL AND ip_address::text = p_ip_address)
    );

  IF v_attempts < p_max_attempts THEN
    INSERT INTO public.rate_limits (user_id, ip_address, action)
    VALUES (
      p_user_id,
      NULLIF(p_ip_address, '')::inet,
      COALESCE(p_action, 'unknown')
    );
  END IF;

  RETURN QUERY SELECT
    (v_attempts < p_max_attempts)::boolean,
    greatest(0, p_max_attempts - v_attempts)::int,
    v_cutoff + make_interval(mins => p_window_minutes);
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit_track FROM public;
GRANT EXECUTE ON FUNCTION public.check_rate_limit_track TO service_role;