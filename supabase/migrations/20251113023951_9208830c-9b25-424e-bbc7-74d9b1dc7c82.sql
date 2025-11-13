-- Fix overly permissive profiles RLS policy
-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Public can view limited profile info" ON public.profiles;
DROP POLICY IF EXISTS "Public can view basic profile info" ON public.profiles;

-- Create a secure public view that only exposes safe fields
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT 
  id,
  full_name,
  avatar_url,
  is_verified,
  created_at
FROM public.profiles;

-- Grant SELECT on the view to everyone
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- Create a more restrictive policy for the profiles table
-- Only authenticated users can see basic info of other users
CREATE POLICY "Authenticated users can view basic profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Users can see their own full profile
  auth.uid() = id
  OR
  -- Or see limited info if they're in an active rental together
  EXISTS (
    SELECT 1 FROM rentals
    WHERE (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
    AND (rentals.renter_id = profiles.id OR rentals.owner_id = profiles.id)
    AND rentals.status IN ('approved', 'active', 'completed')
  )
);

-- Anonymous users can only access the public view, not the table directly
-- The existing policies already handle this, no changes needed for anon access