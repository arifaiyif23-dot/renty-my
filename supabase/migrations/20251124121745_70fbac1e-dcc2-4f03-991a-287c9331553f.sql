-- Create payment_flow_logs table for tracking payment lifecycle
CREATE TABLE IF NOT EXISTS payment_flow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  rental_id UUID REFERENCES rentals(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN (
    'rental_created',
    'payment_created', 
    'bill_created',
    'callback_received',
    'payment_verified',
    'payment_failed',
    'payment_expired'
  )),
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'info')),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_payment_flow_logs_payment_id ON payment_flow_logs(payment_id);
CREATE INDEX idx_payment_flow_logs_rental_id ON payment_flow_logs(rental_id);
CREATE INDEX idx_payment_flow_logs_created_at ON payment_flow_logs(created_at DESC);
CREATE INDEX idx_payment_flow_logs_stage ON payment_flow_logs(stage);

-- RLS policies
ALTER TABLE payment_flow_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all payment logs"
  ON payment_flow_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert payment logs"
  ON payment_flow_logs FOR INSERT
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON payment_flow_logs TO service_role;
GRANT SELECT ON payment_flow_logs TO authenticated;