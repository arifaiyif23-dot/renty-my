-- Phase 4: DB architecture cleanup

-- 1. Drop old duplicate profile views, keep canonical public_profiles
DROP VIEW IF EXISTS public.profiles_public;
DROP VIEW IF EXISTS public.profiles_public_safe;

-- 2. Drop the stale INET overload of check_rate_limit_enhanced (queries rate_limits table, not failed_login_attempts)
--    The TEXT overload (which queries failed_login_attempts) is the canonical version
DROP FUNCTION IF EXISTS public.check_rate_limit_enhanced(p_user_id UUID, p_ip_address INET, p_action TEXT, p_max_attempts INT, p_window_minutes INT);

-- 3. Drop the duplicate old check_rate_limit (non-enhanced) — the enhanced version is canonical
--    This also removes the last reference to the old rate_limits table
DROP FUNCTION IF EXISTS public.check_rate_limit(UUID, INET, TEXT, INT, INT);

COMMENT ON VIEW public.public_profiles IS 'Canonical public profile view for anonymous/authenticated access. Use this instead of querying profiles base table.';
