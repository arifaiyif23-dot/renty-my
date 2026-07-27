-- release_payment_lock should DELETE the row, not just set status='released'
-- because acquire_payment_lock uses ON CONFLICT (rental_id) DO NOTHING
-- and that matches ANY existing row, even released/expired ones.
CREATE OR REPLACE FUNCTION public.release_payment_lock(p_rental_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM payment_locks WHERE rental_id = p_rental_id;
END;
$$;

-- Also update acquire_payment_lock to delete expired/released rows before
-- attempting insert, and use a more robust approach: DELETE stale locks
-- then INSERT fresh.
CREATE OR REPLACE FUNCTION public.acquire_payment_lock(
  p_rental_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lock_acquired BOOLEAN := FALSE;
BEGIN
  -- Clean up any stale locks first (expired or released)
  DELETE FROM payment_locks
  WHERE rental_id = p_rental_id
    AND (status IN ('released', 'expired') OR expires_at < NOW());

  INSERT INTO payment_locks (rental_id, locked_by, expires_at)
  VALUES (p_rental_id, p_user_id, NOW() + INTERVAL '5 minutes')
  ON CONFLICT (rental_id) DO NOTHING
  RETURNING TRUE INTO lock_acquired;

  RETURN COALESCE(lock_acquired, FALSE);
END;
$$;
