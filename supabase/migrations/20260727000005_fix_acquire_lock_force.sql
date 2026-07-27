-- acquire_payment_lock now always DELETEs the old lock then INSERTs a new one.
-- The old ON CONFLICT DO NOTHING pattern caused the same user to get locked out
-- if a previous invocation crashed before releasing (e.g. Supabase gateway timeout).
-- 30-second TTL ensures even a hard crash auto-clears quickly.
CREATE OR REPLACE FUNCTION public.acquire_payment_lock(
  p_rental_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM payment_locks WHERE rental_id = p_rental_id;
  INSERT INTO payment_locks (rental_id, locked_by, expires_at)
  VALUES (p_rental_id, p_user_id, NOW() + INTERVAL '30 seconds');
  RETURN TRUE;
END;
$$;
