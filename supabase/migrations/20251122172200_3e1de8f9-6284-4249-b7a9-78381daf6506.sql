-- Add platform fee model setting
INSERT INTO platform_settings (key, value, description)
VALUES (
  'platform_fee_model',
  '"renter_charged"'::jsonb,
  'How platform fee is charged: "renter_charged" (10% added to price) or "owner_charged" (10% deducted from payout)'
)
ON CONFLICT (key) DO UPDATE
SET value = '"renter_charged"'::jsonb,
    description = 'How platform fee is charged: "renter_charged" (10% added to price) or "owner_charged" (10% deducted from payout)';

-- Add helpful view for analytics
CREATE OR REPLACE VIEW rental_fee_breakdown AS
SELECT 
  r.id as rental_id,
  r.total_price,
  ROUND(r.total_price / 1.10, 2) as base_rental_amount,
  ROUND(r.total_price - (r.total_price / 1.10), 2) as platform_fee,
  r.renter_id,
  r.owner_id,
  r.created_at
FROM rentals r
WHERE r.payment_status = 'escrowed' OR r.payment_status = 'paid';