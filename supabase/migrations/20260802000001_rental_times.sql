-- Rental pickup/return times + timestamp-aware scheduling + auto timing.
-- Adds scheduled pickup_time / return_time to rentals, upgrades the overlap RPC
-- to hour-granular comparison (allowing same-day rentals when hours don't clash),
-- and anchors no-show / overdue / late-return automation on the scheduled times.

-- 1. Scheduled times on rentals (NULL for legacy rentals; required for new bookings)
ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS pickup_time TIME,
  ADD COLUMN IF NOT EXISTS return_time TIME;

-- 2. Overlap check becomes timestamp-aware (date + time).
-- Legacy rentals with NULL times are treated as all-day (00:00 - 23:59) so the
-- previous day-level blocking still applies to them.
DROP FUNCTION IF EXISTS public.create_rental_with_overlap_check(UUID, UUID, UUID, DATE, DATE, DECIMAL);
DROP FUNCTION IF EXISTS public.create_rental_with_overlap_check(UUID, UUID, UUID, DATE, DATE, DECIMAL, TEXT);

CREATE OR REPLACE FUNCTION public.create_rental_with_overlap_check(
  p_item_id UUID,
  p_renter_id UUID,
  p_owner_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_total_price DECIMAL,
  p_status TEXT DEFAULT 'requested',
  p_pickup_time TIME DEFAULT NULL,
  p_return_time TIME DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rental_id UUID;
  v_overlap_count INT;
  v_lock_key INT;
  v_start_ts TIMESTAMPTZ;
  v_end_ts TIMESTAMPTZ;
BEGIN
  v_lock_key := ('x' || substr(md5(p_item_id::text), 1, 8))::bit(32)::int;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  v_start_ts := (p_start_date + COALESCE(p_pickup_time, '00:00'::time))::timestamptz;
  v_end_ts := (p_end_date + COALESCE(p_return_time, '00:00'::time))::timestamptz;

  SELECT COUNT(*) INTO v_overlap_count
  FROM public.rentals
  WHERE item_id = p_item_id
    AND status IN ('payment_pending', 'reserved', 'confirmed', 'active')
    AND (start_date + COALESCE(pickup_time, '00:00'::time))::timestamptz < v_end_ts
    AND (end_date + COALESCE(return_time, '23:59'::time))::timestamptz > v_start_ts;

  IF v_overlap_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item is not available for the selected dates');
  END IF;

  INSERT INTO public.rentals (item_id, renter_id, owner_id, start_date, end_date, total_price, status, pickup_time, return_time)
  VALUES (p_item_id, p_renter_id, p_owner_id, p_start_date, p_end_date, p_total_price, p_status::rental_status, p_pickup_time, p_return_time)
  RETURNING id INTO v_rental_id;

  RETURN jsonb_build_object('success', true, 'rental_id', v_rental_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_rental_with_overlap_check(UUID, UUID, UUID, DATE, DATE, DECIMAL, TEXT, TIME, TIME) TO service_role;

COMMENT ON FUNCTION public.create_rental_with_overlap_check IS 'Atomically checks for time-aware overlapping rentals and creates a new rental under advisory lock';

-- 3. No-show now anchored on the scheduled pickup time (falls back to 09:00 for legacy)
DROP FUNCTION IF EXISTS public.cancel_no_show_rentals();
CREATE FUNCTION public.cancel_no_show_rentals()
RETURNS TABLE(rental_id UUID, item_id UUID, renter_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.rentals
  SET status = 'cancelled'
  WHERE status = 'confirmed'
    AND (start_date + COALESCE(pickup_time, '09:00'::time))::timestamptz + INTERVAL '24 hours' < NOW()
    AND actual_start_at IS NULL
  RETURNING id, item_id, renter_id;
END;
$$;

COMMENT ON FUNCTION public.cancel_no_show_rentals IS 'Cancels confirmed rentals where scheduled pickup + 24h passed with no handover. Call from cron.';

-- 4. Overdue escalation anchored on the scheduled return time (falls back to 17:00 for legacy)
CREATE OR REPLACE FUNCTION public.escalate_overdue_rentals()
RETURNS TABLE(rental_id UUID, renter_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_grace_hours NUMERIC(10,2);
  v_overdue_threshold INTERVAL;
BEGIN
  SELECT COALESCE(
    (SELECT setting_value::NUMERIC FROM platform_settings
     WHERE setting_key = 'overdue_escalation_hours'),
    24
  ) INTO v_grace_hours;

  v_overdue_threshold := (v_grace_hours || ' hours')::INTERVAL;

  RETURN QUERY
  WITH overdue_rentals AS (
    SELECT r.id, r.renter_id, r.owner_id
    FROM rentals r
    WHERE r.status = 'overdue'
      AND (r.end_date + COALESCE(r.return_time, '17:00'::time))::timestamptz < NOW() - v_overdue_threshold
      AND NOT EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = r.renter_id
          AND p.restriction_level IN ('limited_access', 'suspended')
          AND p.restricted_at > r.updated_at
      )
  )
  UPDATE profiles p
  SET
    restriction_level = 'limited_access',
    restriction_reason = FORMAT('Overdue rental %s - no communication for %s hours after due date', overdue_rentals.id, v_grace_hours),
    restricted_at = NOW(),
    updated_at = NOW()
  FROM overdue_rentals
  WHERE p.id = overdue_rentals.renter_id
  RETURNING overdue_rentals.id, overdue_rentals.renter_id;
END;
$$;

-- 5. Late-return penalty anchored on the scheduled return time; hourly rate prefers
-- the item's price_per_hour and falls back to the SOP 10%-of-daily rate.
CREATE OR REPLACE FUNCTION public.compute_late_penalty(
  p_rental_id UUID,
  p_actual_return_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS NUMERIC(10,2)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_expected_end TIMESTAMPTZ;
  v_price_per_day NUMERIC(10,2);
  v_price_per_hour NUMERIC(10,2);
  v_hours_late NUMERIC(10,2);
  v_chargeable_hours NUMERIC(10,2);
  v_penalty NUMERIC(10,2);
  v_grace_period NUMERIC(10,2);
  v_hourly_rate NUMERIC(10,2);
BEGIN
  SELECT (r.end_date + COALESCE(r.return_time, '00:00'::time))::timestamptz,
         i.price_per_day,
         i.price_per_hour
  INTO v_expected_end, v_price_per_day, v_price_per_hour
  FROM rentals r
  JOIN items i ON i.id = r.item_id
  WHERE r.id = p_rental_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(
    (SELECT setting_value::NUMERIC FROM platform_settings
     WHERE setting_key = 'late_return_grace_period_hours'),
    3
  ) INTO v_grace_period;

  -- Prefer the item's own hourly rate; else SOP fallback = 10% of daily price.
  IF v_price_per_hour IS NOT NULL AND v_price_per_hour > 0 THEN
    v_hourly_rate := v_price_per_hour;
  ELSE
    SELECT COALESCE(
      (SELECT setting_value::NUMERIC FROM platform_settings
       WHERE setting_key = 'late_return_hourly_rate_pct'),
      10
    ) INTO v_hourly_rate;
    v_hourly_rate := COALESCE(v_price_per_day, 0) * (v_hourly_rate / 100);
  END IF;

  v_hours_late := EXTRACT(EPOCH FROM (p_actual_return_date - v_expected_end)) / 3600;

  IF v_hours_late <= 0 THEN
    RETURN 0;
  END IF;

  v_chargeable_hours := GREATEST(0, v_hours_late - v_grace_period);

  v_penalty := v_chargeable_hours * v_hourly_rate;

  v_penalty := ROUND(v_penalty, 2);

  INSERT INTO late_return_records (rental_id, expected_end_date, actual_return_date, hours_late, grace_period_hours, chargeable_hours, penalty_amount)
  VALUES (p_rental_id, v_expected_end, p_actual_return_date, v_hours_late, v_grace_period, v_chargeable_hours, v_penalty);

  IF v_penalty > 0 THEN
    INSERT INTO penalty_records (rental_id, penalty_type, amount, description, created_by)
    VALUES (p_rental_id, 'late_return', v_penalty,
            format('Late return: %s hours late (%s chargeable after %s-hour grace). Hourly rate: RM%s/hr.',
                   ROUND(v_hours_late, 1), ROUND(v_chargeable_hours, 1), ROUND(v_grace_period, 1), ROUND(v_hourly_rate, 2)),
            NULL);
  END IF;

  RETURN v_penalty;
END;
$$;
