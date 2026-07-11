-- Fix TOCTOU race condition in request-booking:
-- Atomic check-and-insert for rentals to prevent double-booking

CREATE OR REPLACE FUNCTION public.create_rental_with_overlap_check(
  p_item_id UUID,
  p_renter_id UUID,
  p_owner_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_total_price DECIMAL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rental_id UUID;
  v_overlap_count INT;
  v_lock_key INT;
BEGIN
  -- Use advisory lock on item_id hash to serialize concurrent bookings for same item
  v_lock_key := ('x' || substr(md5(p_item_id::text), 1, 8))::bit(32)::int;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Check for overlapping active rentals
  SELECT COUNT(*) INTO v_overlap_count
  FROM public.rentals
  WHERE item_id = p_item_id
    AND status IN ('pending_approval', 'approved', 'paid', 'active')
    AND start_date <= p_end_date
    AND end_date >= p_start_date;

  IF v_overlap_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item is not available for the selected dates');
  END IF;

  -- Create rental
  INSERT INTO public.rentals (item_id, renter_id, owner_id, start_date, end_date, total_price, status)
  VALUES (p_item_id, p_renter_id, p_owner_id, p_start_date, p_end_date, p_total_price, 'pending_approval')
  RETURNING id INTO v_rental_id;

  RETURN jsonb_build_object('success', true, 'rental_id', v_rental_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_rental_with_overlap_check TO service_role;
COMMENT ON FUNCTION public.create_rental_with_overlap_check IS 'Atomically checks for overlapping rentals and creates a new rental under advisory lock';
