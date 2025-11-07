-- Create rate_limits table for API rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address inet,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT rate_limits_check CHECK (user_id IS NOT NULL OR ip_address IS NOT NULL)
);

-- Indexes for performance
CREATE INDEX idx_rate_limits_user_action_time ON public.rate_limits(user_id, action, created_at DESC);
CREATE INDEX idx_rate_limits_ip_action_time ON public.rate_limits(ip_address, action, created_at DESC);
CREATE INDEX idx_rate_limits_created_at ON public.rate_limits(created_at);

-- RLS Policies
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage rate limits"
  ON public.rate_limits
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view their own rate limits"
  ON public.rate_limits
  FOR SELECT
  USING (auth.uid() = user_id);

-- Function to check rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id uuid,
  p_ip_address inet,
  p_action text,
  p_max_attempts integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
  v_cutoff_time timestamptz;
BEGIN
  -- Calculate cutoff time
  v_cutoff_time := NOW() - (p_window_seconds || ' seconds')::interval;
  
  -- Count recent attempts for this user/IP and action
  SELECT COUNT(*) INTO v_count
  FROM rate_limits
  WHERE action = p_action
    AND created_at > v_cutoff_time
    AND (
      (p_user_id IS NOT NULL AND user_id = p_user_id) OR
      (p_ip_address IS NOT NULL AND ip_address = p_ip_address)
    );
  
  -- Log this attempt
  INSERT INTO rate_limits (user_id, ip_address, action)
  VALUES (p_user_id, p_ip_address, p_action);
  
  -- Return true if under limit, false if exceeded
  RETURN v_count < p_max_attempts;
END;
$$;

-- Function to cleanup old rate limit records
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete records older than 7 days
  DELETE FROM rate_limits
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_rate_limit TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_old_rate_limits TO service_role;

-- Add comments
COMMENT ON TABLE public.rate_limits IS 'Tracks rate limiting attempts for API endpoints to prevent abuse';
COMMENT ON FUNCTION public.check_rate_limit IS 'Checks if user/IP has exceeded rate limit for an action and logs the attempt';
COMMENT ON FUNCTION public.cleanup_old_rate_limits IS 'Removes rate limit records older than 7 days to keep table size manageable';