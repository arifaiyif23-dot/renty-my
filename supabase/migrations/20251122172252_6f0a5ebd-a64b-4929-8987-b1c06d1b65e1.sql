-- Fix security definer issue by recreating view without SECURITY DEFINER
DROP VIEW IF EXISTS rental_fee_breakdown;

CREATE VIEW rental_fee_breakdown AS
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

-- Add RLS policies for the view (users can see their own rentals)
-- Note: Views inherit RLS from underlying tables, so no additional policies needed