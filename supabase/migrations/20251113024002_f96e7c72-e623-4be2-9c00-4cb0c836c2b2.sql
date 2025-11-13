-- Fix the profiles_public view to not be a SECURITY DEFINER view
-- Drop and recreate without SECURITY DEFINER
DROP VIEW IF EXISTS public.profiles_public;

-- Create a simple view without SECURITY DEFINER
-- This will use the permissions of the querying user
CREATE VIEW public.profiles_public 
WITH (security_invoker = true) AS
SELECT 
  id,
  full_name,
  avatar_url,
  is_verified,
  created_at
FROM public.profiles;

-- Grant SELECT on the view
GRANT SELECT ON public.profiles_public TO anon, authenticated;