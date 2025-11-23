-- Create payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID REFERENCES rentals(id) NOT NULL UNIQUE,
  
  rental_amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL,
  platform_fee_percentage DECIMAL(5,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  
  toyyibpay_bill_code TEXT UNIQUE,
  toyyibpay_bill_url TEXT,
  toyyibpay_transaction_id TEXT,
  
  status TEXT NOT NULL DEFAULT 'pending',
  
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rentals
      WHERE rentals.id = payments.rental_id
      AND (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
    )
  );

CREATE POLICY "System can insert payments"
  ON payments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update payments"
  ON payments FOR UPDATE
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Ensure platform_fee_percentage exists in platform_settings
INSERT INTO platform_settings (key, value, description)
VALUES ('platform_fee_percentage', '10', 'Platform transaction fee percentage charged on each rental')
ON CONFLICT (key) DO NOTHING;