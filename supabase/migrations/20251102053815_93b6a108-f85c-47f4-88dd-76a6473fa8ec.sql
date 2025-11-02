-- Create rental_insurance table for insurance coverage tracking
CREATE TABLE IF NOT EXISTS public.rental_insurance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('basic', 'premium', 'platinum')),
  coverage_amount NUMERIC NOT NULL,
  premium_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create referrals table for tracking referral system
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rewarded')),
  referrer_reward NUMERIC DEFAULT 0,
  referee_reward NUMERIC DEFAULT 0,
  first_rental_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(referrer_id, referee_id)
);

-- Create rental_delivery table for delivery scheduling
CREATE TABLE IF NOT EXISTS public.rental_delivery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('self_pickup', 'delivery')),
  delivery_provider TEXT CHECK (delivery_provider IN ('lalamove', 'grab_express', 'manual')),
  delivery_fee NUMERIC NOT NULL DEFAULT 0,
  pickup_address TEXT,
  pickup_scheduled_at TIMESTAMPTZ,
  pickup_completed_at TIMESTAMPTZ,
  return_address TEXT,
  return_scheduled_at TIMESTAMPTZ,
  return_completed_at TIMESTAMPTZ,
  delivery_instructions TEXT,
  tracking_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'in_transit', 'delivered', 'returned', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.rental_insurance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_delivery ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rental_insurance
CREATE POLICY "Users can view their rental insurance"
  ON public.rental_insurance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rentals
      WHERE rentals.id = rental_insurance.rental_id
      AND (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
    )
  );

CREATE POLICY "Users can create insurance for their bookings"
  ON public.rental_insurance FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rentals
      WHERE rentals.id = rental_insurance.rental_id
      AND rentals.renter_id = auth.uid()
    )
  );

-- RLS Policies for referrals
CREATE POLICY "Users can view their own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

CREATE POLICY "Users can create their own referral codes"
  ON public.referrals FOR INSERT
  WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "System can update referral status"
  ON public.referrals FOR UPDATE
  USING (TRUE);

-- RLS Policies for rental_delivery
CREATE POLICY "Users can view their rental delivery"
  ON public.rental_delivery FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rentals
      WHERE rentals.id = rental_delivery.rental_id
      AND (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
    )
  );

CREATE POLICY "Renters can create delivery for their bookings"
  ON public.rental_delivery FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rentals
      WHERE rentals.id = rental_delivery.rental_id
      AND rentals.renter_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their rental delivery"
  ON public.rental_delivery FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.rentals
      WHERE rentals.id = rental_delivery.rental_id
      AND (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
    )
  );

-- Create indexes for performance
CREATE INDEX idx_rental_insurance_rental_id ON public.rental_insurance(rental_id);
CREATE INDEX idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_referee_id ON public.referrals(referee_id);
CREATE INDEX idx_referrals_code ON public.referrals(referral_code);
CREATE INDEX idx_rental_delivery_rental_id ON public.rental_delivery(rental_id);

-- Trigger for updated_at on rental_delivery
CREATE TRIGGER update_rental_delivery_updated_at
  BEFORE UPDATE ON public.rental_delivery
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate 8 character alphanumeric code
    code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM referrals WHERE referral_code = code) INTO exists_check;
    
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  RETURN code;
END;
$$;