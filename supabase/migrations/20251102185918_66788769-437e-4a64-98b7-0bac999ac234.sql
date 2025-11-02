-- Create payment_holds table for admin payment oversight
CREATE TABLE public.payment_holds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rental_id UUID NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  platform_fee NUMERIC NOT NULL DEFAULT 0,
  owner_payout NUMERIC NOT NULL,
  hold_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'released', 'refunded')),
  held_by UUID REFERENCES auth.users(id),
  held_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.payment_holds ENABLE ROW LEVEL SECURITY;

-- Only admins can view and manage payment holds
CREATE POLICY "Admins can manage payment holds"
ON public.payment_holds
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_payment_holds_rental_id ON public.payment_holds(rental_id);
CREATE INDEX idx_payment_holds_status ON public.payment_holds(status);
CREATE INDEX idx_payment_holds_held_at ON public.payment_holds(held_at DESC);

-- Create withdrawal_requests table for owners to request payouts
CREATE TABLE public.withdrawal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  bank_name TEXT,
  account_number TEXT,
  account_holder_name TEXT,
  rejection_reason TEXT,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Users can create and view their own withdrawal requests
CREATE POLICY "Users can create withdrawal requests"
ON public.withdrawal_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own withdrawal requests"
ON public.withdrawal_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view and manage all withdrawal requests
CREATE POLICY "Admins can manage withdrawal requests"
ON public.withdrawal_requests
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes
CREATE INDEX idx_withdrawal_requests_user_id ON public.withdrawal_requests(user_id);
CREATE INDEX idx_withdrawal_requests_status ON public.withdrawal_requests(status);
CREATE INDEX idx_withdrawal_requests_created_at ON public.withdrawal_requests(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_payment_holds_updated_at
BEFORE UPDATE ON public.payment_holds
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_withdrawal_requests_updated_at
BEFORE UPDATE ON public.withdrawal_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();