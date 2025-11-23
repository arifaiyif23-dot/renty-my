-- Create owner bank accounts table
CREATE TABLE owner_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL UNIQUE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder_name TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE owner_bank_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own bank accounts"
  ON owner_bank_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own bank accounts"
  ON owner_bank_accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all bank accounts"
  ON owner_bank_accounts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create payouts table
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID REFERENCES rentals(id) NOT NULL UNIQUE,
  payment_id UUID REFERENCES payments(id) NOT NULL,
  owner_id UUID REFERENCES profiles(id) NOT NULL,
  
  -- Amount breakdown
  rental_amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL,
  payout_amount DECIMAL(10,2) NOT NULL, -- rental_amount - platform_fee
  
  -- Bank details (snapshot at time of payout)
  bank_name TEXT,
  account_number TEXT,
  account_holder_name TEXT,
  
  -- Payout status
  status TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' -> waiting to be processed
  -- 'processing' -> admin is processing
  -- 'completed' -> paid out successfully
  -- 'failed' -> payout failed
  -- 'cancelled' -> payout cancelled
  
  processed_by UUID REFERENCES profiles(id),
  processed_at TIMESTAMPTZ,
  
  failure_reason TEXT,
  transaction_reference TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Owners can view their own payouts"
  ON payouts FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Admins can manage all payouts"
  ON payouts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can create payouts"
  ON payouts FOR INSERT
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_owner_bank_accounts_updated_at
  BEFORE UPDATE ON owner_bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payouts_updated_at
  BEFORE UPDATE ON payouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-create payout when rental completes
CREATE OR REPLACE FUNCTION create_payout_on_rental_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_bank_account owner_bank_accounts%ROWTYPE;
  v_payout_amount DECIMAL(10,2);
BEGIN
  -- Only process when rental status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Get payment details
    SELECT * INTO v_payment
    FROM payments
    WHERE rental_id = NEW.id;
    
    -- Skip if no payment found (shouldn't happen)
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;
    
    -- Calculate payout amount
    v_payout_amount := v_payment.rental_amount - v_payment.platform_fee;
    
    -- Get owner's bank account
    SELECT * INTO v_bank_account
    FROM owner_bank_accounts
    WHERE user_id = NEW.owner_id;
    
    -- Create payout record
    INSERT INTO payouts (
      rental_id,
      payment_id,
      owner_id,
      rental_amount,
      platform_fee,
      payout_amount,
      bank_name,
      account_number,
      account_holder_name,
      status
    ) VALUES (
      NEW.id,
      v_payment.id,
      NEW.owner_id,
      v_payment.rental_amount,
      v_payment.platform_fee,
      v_payout_amount,
      v_bank_account.bank_name,
      v_bank_account.account_number,
      v_bank_account.account_holder_name,
      'pending'
    )
    ON CONFLICT (rental_id) DO NOTHING; -- Prevent duplicate payouts
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trigger_create_payout_on_completion
  AFTER UPDATE ON rentals
  FOR EACH ROW
  EXECUTE FUNCTION create_payout_on_rental_completion();