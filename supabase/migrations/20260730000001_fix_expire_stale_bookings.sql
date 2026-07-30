-- Fix expire_stale_bookings: remove broken subquery that prevented expiring
-- rentals with existing booking_events (any status-change created one).
CREATE OR REPLACE FUNCTION public.expire_stale_bookings()
RETURNS TABLE(rental_id UUID, item_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.rentals
  SET status = 'cancelled'
  WHERE id IN (
    SELECT r.id FROM public.rentals r
    WHERE (
      (r.status = 'requested' AND r.created_at < NOW() - INTERVAL '30 minutes') OR
      (r.status = 'payment_pending' AND r.updated_at < NOW() - INTERVAL '30 minutes') OR
      (r.status = 'reserved' AND r.updated_at < NOW() - INTERVAL '48 hours')
    )
    LIMIT 50
  )
  RETURNING id, item_id;
END;
$$;
