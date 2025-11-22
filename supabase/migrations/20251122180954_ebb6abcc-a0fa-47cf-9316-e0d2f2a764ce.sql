-- Update rentals payment_status constraint to support new payment flow
ALTER TABLE rentals DROP CONSTRAINT IF EXISTS rentals_payment_status_check;

-- Add updated constraint with 'pending', 'paid', 'failed', 'refunded' values
ALTER TABLE rentals ADD CONSTRAINT rentals_payment_status_check 
CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));