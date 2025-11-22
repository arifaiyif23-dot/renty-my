-- Fix security definer view by explicitly setting SECURITY INVOKER
-- This ensures the view respects the querying user's RLS policies

DROP VIEW IF EXISTS rental_fee_breakdown;

CREATE VIEW rental_fee_breakdown 
WITH (security_invoker = true)
AS
SELECT 
  r.id as rental_id,
  r.total_price,
  ROUND(r.total_price / 1.10, 2) as base_rental_amount,
  ROUND(r.total_price - (r.total_price / 1.10), 2) as platform_fee,
  r.renter_id,
  r.owner_id,
  r.created_at
FROM rentals r
WHERE r.payment_status IN ('escrowed', 'paid');