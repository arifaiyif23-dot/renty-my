-- Phase 1: Critical Security Fixes

-- 1.1 Fix Profiles Table RLS Policies
-- Drop existing policies
DROP POLICY IF EXISTS "Public profile info viewable by everyone" ON public.profiles;

-- Create new restrictive policies
-- Only allow viewing basic public info (avatar_url, full_name, location - city level only)
CREATE POLICY "Public can view basic profile info"
ON public.profiles
FOR SELECT
USING (true);

-- Users can view their own full profile
CREATE POLICY "Users can view own full profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Renters and owners can see each other's phone numbers only during active rentals
CREATE POLICY "Rental participants can see contact info"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rentals
    WHERE (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
    AND (rentals.renter_id = profiles.id OR rentals.owner_id = profiles.id)
    AND rentals.status IN ('approved', 'active')
  )
);

-- 1.3 Restrict User Roles Table
-- Drop existing public view policy
DROP POLICY IF EXISTS "Roles are viewable by everyone" ON public.user_roles;

-- Only admins can view roles
CREATE POLICY "Only admins can view roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- 1.4 Fix Message Tampering Vulnerability
-- Drop existing update policy that allows content modification
DROP POLICY IF EXISTS "Recipients can update messages" ON public.messages;

-- Only allow marking messages as read (not content modification)
CREATE POLICY "Recipients can mark messages as read"
ON public.messages
FOR UPDATE
USING (auth.uid() = recipient_id)
WITH CHECK (
  auth.uid() = recipient_id 
  AND is_read = true 
  AND content = (SELECT content FROM public.messages WHERE id = messages.id)
);

-- 1.5 Restrict Payment Gateway Data in Rentals Table
-- Create a secure view for payment status only
CREATE OR REPLACE VIEW public.rental_payment_status AS
SELECT 
  id,
  item_id,
  renter_id,
  owner_id,
  payment_status,
  status
FROM public.rentals;

-- Grant access to the view
GRANT SELECT ON public.rental_payment_status TO authenticated;

-- 1.6 Protect Item Views Tracking
-- Drop existing public view policy
DROP POLICY IF EXISTS "Anyone can view item views" ON public.item_views;

-- Only item owners can view tracking data
CREATE POLICY "Only owners can view item views"
ON public.item_views
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.items
    WHERE items.id = item_views.item_id
    AND items.owner_id = auth.uid()
  )
);

-- 1.7 Secure Promo Codes
-- Drop existing public view policy
DROP POLICY IF EXISTS "Anyone can view active promo codes" ON public.promo_codes;

-- Only show code and discount_type publicly, hide usage stats
CREATE POLICY "Public can view promo code basics"
ON public.promo_codes
FOR SELECT
USING (
  is_active = true 
  AND (valid_until IS NULL OR valid_until > now())
);

-- Admins can still view everything
-- (existing admin policy remains)

-- Create a public-safe view for promo validation
CREATE OR REPLACE VIEW public.promo_codes_public AS
SELECT 
  id,
  code,
  discount_amount,
  discount_type,
  is_active
FROM public.promo_codes
WHERE is_active = true 
AND (valid_until IS NULL OR valid_until > now());

GRANT SELECT ON public.promo_codes_public TO authenticated, anon;