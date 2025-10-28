-- Fix SECURITY DEFINER functions by adding SET search_path = public
-- This prevents search_path manipulation attacks

-- 1. Fix update_profile_verification function
CREATE OR REPLACE FUNCTION public.update_profile_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.profiles
  SET is_verified = TRUE
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$function$;

-- 2. Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');
  RETURN NEW;
END;
$function$;

-- 3. Fix handle_new_wallet function
CREATE OR REPLACE FUNCTION public.handle_new_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0.00);
  RETURN NEW;
END;
$function$;

-- 4. Fix increment_item_views function
CREATE OR REPLACE FUNCTION public.increment_item_views(item_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.items
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = item_id_param;
END;
$function$;

-- 5. Fix track_listing_edit function (if exists)
CREATE OR REPLACE FUNCTION public.track_listing_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.last_edited_at = now();
  RETURN NEW;
END;
$function$;

-- Add RLS policies to enforce verification requirements for sensitive operations
-- This prevents unverified users from bypassing client-side checks

-- Policy: Only verified users can create rental listings
DROP POLICY IF EXISTS "Verified users can create items" ON public.items;
CREATE POLICY "Verified users can create items"
ON public.items
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = owner_id AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND is_verified = true
  )
);

-- Policy: Only verified users can book rentals
DROP POLICY IF EXISTS "Verified users can book rentals" ON public.rentals;
CREATE POLICY "Verified users can book rentals"
ON public.rentals
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = renter_id AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND is_verified = true
  )
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_items_category ON public.items(category) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_items_owner_id ON public.items(owner_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status ON public.rentals(status);
CREATE INDEX IF NOT EXISTS idx_rentals_renter_id ON public.rentals(renter_id);
CREATE INDEX IF NOT EXISTS idx_rentals_owner_id ON public.rentals(owner_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON public.wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON public.wallet_transactions(wallet_id);

-- Add price validation constraints
ALTER TABLE public.items
DROP CONSTRAINT IF EXISTS items_price_per_day_min;

ALTER TABLE public.items
ADD CONSTRAINT items_price_per_day_min CHECK (price_per_day >= 1);

ALTER TABLE public.items
DROP CONSTRAINT IF EXISTS items_price_per_day_max;

ALTER TABLE public.items
ADD CONSTRAINT items_price_per_day_max CHECK (price_per_day <= 10000);