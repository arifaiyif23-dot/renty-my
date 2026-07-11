-- Fix rate limiting: create missing failed_login_attempts table
-- and make check_rate_limit_enhanced both check AND track attempts

-- Drop existing overloads of check_rate_limit_enhanced
DROP FUNCTION IF EXISTS public.check_rate_limit_enhanced(p_user_id UUID, p_ip_address TEXT, p_action TEXT, p_max_attempts INT, p_window_minutes INT);
DROP FUNCTION IF EXISTS public.check_rate_limit_enhanced(p_user_id UUID, p_ip_address INET, p_action TEXT, p_max_attempts INT, p_window_minutes INT);

CREATE TABLE IF NOT EXISTS public.failed_login_attempts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_address TEXT,
  action TEXT NOT NULL DEFAULT 'login',
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_identifier CHECK (user_id IS NOT NULL OR ip_address IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_failed_login_user_action_time
  ON public.failed_login_attempts(user_id, action, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_failed_login_ip_action_time
  ON public.failed_login_attempts(ip_address, action, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempted_at
  ON public.failed_login_attempts(attempted_at);

ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage failed_login_attempts"
  ON public.failed_login_attempts
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.failed_login_attempts TO service_role;
GRANT USAGE ON SEQUENCE public.failed_login_attempts_id_seq TO service_role;

COMMENT ON TABLE public.failed_login_attempts IS 'Tracks failed login/signup attempts for rate limiting';

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

  IF v_attempts < p_max_attempts THEN
    INSERT INTO public.failed_login_attempts (user_id, ip_address, action)
    VALUES (p_user_id, p_ip_address, COALESCE(p_action, 'unknown'));
  END IF;

  RETURN QUERY SELECT
    (v_attempts < p_max_attempts)::BOOLEAN,
    GREATEST(0, p_max_attempts - v_attempts)::INT,
    v_cutoff_time + (p_window_minutes * INTERVAL '1 minute');
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit_enhanced TO authenticated, anon;
