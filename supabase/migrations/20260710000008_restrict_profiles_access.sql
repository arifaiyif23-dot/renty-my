-- Restrict profiles access: expand public_profiles view for safe public access
-- 
-- NOTE: Full RLS column-level enforcement on the profiles table requires 
-- breaking PostgREST embedded joins (e.g., owner:profiles(...) in item queries).
-- 
-- Current approach:
-- 1. public_profiles view → used for anonymous/public profile display
-- 2. Frontend queries already SELECT only safe columns (fixed in previous migration)
-- 3. Edge functions use service_role key (bypasses RLS)
-- 
-- Future: Migrate all public profile reads to public_profiles view, then
-- restrict profiles table to owner/admin/rental-participant only.

-- 1. Expand public_profiles view with additional safe columns
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles WITH (security_barrier = true) AS
SELECT
  id,
  full_name,
  avatar_url,
  is_verified,
  verification_level,
  trust_score,
  location,
  created_at,
  is_suspended
FROM public.profiles;

COMMENT ON VIEW public.public_profiles IS
  'Public-safe profile view. Use this for displaying other users profiles. Columns: id, full_name, avatar_url, is_verified, verification_level, trust_score, location, created_at, is_suspended.';

GRANT SELECT ON public.public_profiles TO public;
