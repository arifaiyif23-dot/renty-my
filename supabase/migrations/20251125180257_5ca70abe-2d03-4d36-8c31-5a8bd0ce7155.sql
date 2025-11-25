-- Fix security definer view by recreating with security_invoker
DROP VIEW IF EXISTS public.profiles_public_safe;

CREATE VIEW public.profiles_public_safe
WITH (security_invoker = true)
AS 
SELECT 
  id,
  full_name,
  avatar_url,
  location,
  is_verified,
  created_at
FROM public.profiles;