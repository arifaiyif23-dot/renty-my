-- ============================================================================
-- Fasa A (Audit 2026-08-19): fix the overdue / late-penalty money functions.
--
-- These functions power the live return + escalation flow (complete-rental and
-- process-rental-transitions call them) but are broken at runtime:
--
-- 1. mark_overdue_rentals      : `RETURNING id, renter_id` is ambiguous
--                               (plpgsql result-column name vs table column).
-- 2. escalate_overdue_rentals  : reads `platform_settings.setting_value` /
--                               `setting_key` columns that DO NOT exist (the
--                               table has `key` and `value`) -> column error.
-- 3. compute_late_penalty      : same broken column references (also inserts
--                               into late_return_records / penalty_records).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. mark_overdue_rentals: disambiguate the RETURNING column and anchor on the
--    scheduled return time (17:00 fallback for legacy rentals), keeping the
--    3-hour grace period.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_overdue_rentals()
RETURNS TABLE(rental_id UUID, renter_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH marked AS (
    UPDATE public.rentals r
    SET status = 'overdue',
        updated_at = NOW()
    WHERE r.status = 'active'
      AND (r.end_date + COALESCE(r.return_time, '17:00'::time))::timestamptz < NOW() - INTERVAL '3 hours'
    RETURNING r.id, r.renter_id
  )
  SELECT marked.id, marked.renter_id FROM marked;
END;
$$;

COMMENT ON FUNCTION public.mark_overdue_rentals IS 'Marks active rentals as overdue when scheduled return time + 3h grace has passed. Call from cron.';

-- ----------------------------------------------------------------------------
-- 2. escalate_overdue_rentals: read platform_settings.key/value correctly.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.escalate_overdue_rentals()
RETURNS TABLE(rental_id UUID, renter_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_grace_hours NUMERIC(10,2);
  v_overdue_threshold INTERVAL;
BEGIN
  SELECT COALESCE(
    (SELECT (value::text)::numeric FROM platform_settings
     WHERE key = 'overdue_escalation_hours'),
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

-- ----------------------------------------------------------------------------
-- 3. compute_late_penalty: read platform_settings.key/value correctly.
-- ----------------------------------------------------------------------------
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
    (SELECT (value::text)::numeric FROM platform_settings
     WHERE key = 'late_return_grace_period_hours'),
    3
  ) INTO v_grace_period;

  -- Prefer the item's own hourly rate; else SOP fallback = 10% of daily price.
  IF v_price_per_hour IS NOT NULL AND v_price_per_hour > 0 THEN
    v_hourly_rate := v_price_per_hour;
  ELSE
    SELECT COALESCE(
      (SELECT (value::text)::numeric FROM platform_settings
       WHERE key = 'late_return_hourly_rate_pct'),
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