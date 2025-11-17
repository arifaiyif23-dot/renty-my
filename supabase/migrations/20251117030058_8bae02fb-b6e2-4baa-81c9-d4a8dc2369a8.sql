-- Create payment processing log table for audit trail
CREATE TABLE IF NOT EXISTS payment_processing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('started', 'lock_acquired', 'wallet_updated', 'transaction_recorded', 'rental_updated', 'notifications_sent', 'completed', 'rolled_back', 'failed')),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_payment_log_rental_id ON payment_processing_log(rental_id);
CREATE INDEX idx_payment_log_user_id ON payment_processing_log(user_id);
CREATE INDEX idx_payment_log_created_at ON payment_processing_log(created_at DESC);

-- Enable RLS
ALTER TABLE payment_processing_log ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert logs
CREATE POLICY "Service role can insert payment logs" ON payment_processing_log
  FOR INSERT WITH CHECK (true);

-- Admins can view all logs
CREATE POLICY "Admins can view payment logs" ON payment_processing_log
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Users can view their own payment logs
CREATE POLICY "Users can view own payment logs" ON payment_processing_log
  FOR SELECT USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE payment_processing_log IS 'Audit trail for payment processing steps to track rollbacks and failures';