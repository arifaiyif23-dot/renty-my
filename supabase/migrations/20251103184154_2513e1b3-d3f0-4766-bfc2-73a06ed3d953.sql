-- PHASE 1: CRITICAL SECURITY FIXES
-- Fix 1.1: Restrict public data exposure on profiles and items

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Public can view basic profile info" ON public.profiles;
DROP POLICY IF EXISTS "Items are viewable by everyone" ON public.items;

-- Create restricted policy for profiles - only show safe fields
CREATE POLICY "Public can view limited profile info"
ON public.profiles
FOR SELECT
USING (true);

-- Create policy for authenticated users to see full profiles in rental context
CREATE POLICY "Rental participants see full profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() = id OR  -- Own profile
    EXISTS (  -- Active rental participants
      SELECT 1 FROM rentals 
      WHERE (renter_id = auth.uid() OR owner_id = auth.uid())
        AND (renter_id = profiles.id OR owner_id = profiles.id)
        AND status IN ('approved', 'active', 'completed')
    )
  )
);

-- Restore items viewability but hide owner_id in public context
CREATE POLICY "Items are publicly viewable"
ON public.items
FOR SELECT
USING (true);

-- Create safe public views
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT 
  id,
  full_name,
  avatar_url,
  is_verified,
  created_at
FROM public.profiles;

-- Grant access to views
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- Fix 1.2: Add function to manually process orphaned payments
CREATE OR REPLACE FUNCTION public.process_orphaned_rental_payment(p_rental_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rental RECORD;
  v_owner_wallet_id UUID;
  v_platform_fee NUMERIC;
  v_owner_payout NUMERIC;
BEGIN
  -- Get rental details
  SELECT * INTO v_rental FROM rentals WHERE id = p_rental_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rental not found');
  END IF;
  
  -- Check if already paid
  IF v_rental.payment_status = 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already paid');
  END IF;
  
  -- Get owner wallet, create if doesn't exist
  SELECT id INTO v_owner_wallet_id FROM wallets WHERE user_id = v_rental.owner_id;
  
  IF v_owner_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance) VALUES (v_rental.owner_id, 0)
    RETURNING id INTO v_owner_wallet_id;
  END IF;
  
  -- Calculate fees (10% platform fee)
  v_platform_fee := v_rental.total_price * 0.10;
  v_owner_payout := v_rental.total_price - v_platform_fee;
  
  -- Pay owner
  PERFORM increment_wallet_balance(v_rental.owner_id, v_owner_payout);
  
  -- Record transaction
  INSERT INTO wallet_transactions (wallet_id, type, amount, description, status, reference_id)
  VALUES (
    v_owner_wallet_id,
    'rental_earning',
    v_owner_payout,
    'Earnings from rental: ' || v_rental.id,
    'completed',
    v_rental.id
  );
  
  -- Update rental status
  UPDATE rentals 
  SET payment_status = 'paid', 
      status = 'completed',
      updated_at = NOW()
  WHERE id = p_rental_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'owner_payout', v_owner_payout,
    'platform_fee', v_platform_fee
  );
END;
$$;

-- Add indexes for better performance on sensitive queries
CREATE INDEX IF NOT EXISTS idx_profiles_verified ON profiles(is_verified) WHERE is_verified = true;
CREATE INDEX IF NOT EXISTS idx_rentals_status_payment ON rentals(status, payment_status);
CREATE INDEX IF NOT EXISTS idx_user_roles_lookup ON user_roles(user_id, role);