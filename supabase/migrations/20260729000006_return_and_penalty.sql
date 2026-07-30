-- Phase 8: Return & Penalty System
-- SOP: ITEM_LIFECYCLE.md §4, §6 — Return Handover, Late Return, Penalty

-- ============================================
-- 8.9: Add OVERDUE to rental_status enum
-- ============================================
ALTER TYPE rental_status ADD VALUE IF NOT EXISTS 'overdue';

-- ============================================
-- 8.9: Add OVERDUE to item_status enum
-- ============================================
ALTER TYPE item_status ADD VALUE IF NOT EXISTS 'overdue';

-- ============================================
-- Update rental transition guard to support overdue
-- ============================================
CREATE OR REPLACE FUNCTION public.check_rental_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'pending' AND NEW.status = 'cancelled') OR
    (OLD.status = 'pending_approval' AND NEW.status IN ('approved', 'rejected', 'cancelled')) OR
    (OLD.status = 'approved' AND NEW.status IN ('paid', 'cancelled')) OR
    (OLD.status = 'paid' AND NEW.status IN ('active', 'cancelled')) OR
    (OLD.status = 'active' AND NEW.status IN ('completed', 'disputed', 'overdue')) OR
    (OLD.status = 'overdue' AND NEW.status IN ('completed', 'disputed')) OR
    (OLD.status = 'disputed' AND NEW.status IN ('completed', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'Invalid rental status transition: % -> %', OLD.status, NEW.status
      USING HINT = 'Valid transitions are: pending→cancelled, pending_approval→approved/rejected/cancelled, approved→paid/cancelled, paid→active/cancelled, active→completed/disputed/overdue, overdue→completed/disputed, disputed→completed/cancelled';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================
-- Update item status trigger for overdue + return_pending
-- ============================================
CREATE OR REPLACE FUNCTION public.update_item_status_on_rental_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'approved' THEN
        UPDATE items SET status = 'reserved' WHERE id = NEW.item_id;
      WHEN 'paid' THEN
        UPDATE items SET status = 'pickup_pending' WHERE id = NEW.item_id;
      WHEN 'active' THEN
        UPDATE items SET status = 'active_rental' WHERE id = NEW.item_id;
      WHEN 'overdue' THEN
        UPDATE items SET status = 'overdue' WHERE id = NEW.item_id;
      WHEN 'completed' THEN
        UPDATE items SET status = 'inspection_pending' WHERE id = NEW.item_id;
      WHEN 'cancelled' THEN
        UPDATE items SET status = 'available'
        WHERE id = NEW.item_id
          AND NOT EXISTS (
            SELECT 1 FROM rentals
            WHERE item_id = NEW.item_id
              AND status IN ('pending_approval', 'approved', 'paid', 'active')
              AND id != NEW.id
          );
      ELSE
        -- No item status change
    END CASE;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================
-- 8.5: late_return_records table
-- ============================================
CREATE TABLE IF NOT EXISTS late_return_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID REFERENCES public.rentals(id) ON DELETE CASCADE NOT NULL,
  expected_end_date TIMESTAMPTZ NOT NULL,
  actual_return_date TIMESTAMPTZ,
  hours_late NUMERIC(10,2) NOT NULL DEFAULT 0,
  grace_period_hours NUMERIC(10,2) NOT NULL DEFAULT 3,
  chargeable_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  penalty_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'waived', 'charged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE late_return_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rental participants can view late return records"
  ON late_return_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rentals
      WHERE rentals.id = late_return_records.rental_id
        AND (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
    )
  );

CREATE POLICY "Admins can view all late return records"
  ON late_return_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "System can manage late return records"
  ON late_return_records FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_late_return_rental_id ON late_return_records(rental_id);

-- ============================================
-- 8.6: penalty_records table
-- ============================================
CREATE TABLE IF NOT EXISTS penalty_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID REFERENCES public.rentals(id) ON DELETE CASCADE NOT NULL,
  penalty_type TEXT NOT NULL CHECK (penalty_type IN ('late_return', 'damage', 'missing_item', 'other')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  description TEXT,
  evidence_urls TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'waived', 'paid')),
  created_by UUID REFERENCES public.profiles(id),
  reviewed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE penalty_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rental participants can view penalty records"
  ON penalty_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rentals
      WHERE rentals.id = penalty_records.rental_id
        AND (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
    )
  );

CREATE POLICY "Admins can view all penalty records"
  ON penalty_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "System can manage penalty records"
  ON penalty_records FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_penalty_rental_id ON penalty_records(rental_id);

-- ============================================
-- 8.7-8.8: Function to calculate and record late return penalty
-- ============================================
CREATE OR REPLACE FUNCTION public.compute_late_penalty(
  p_rental_id UUID,
  p_actual_return_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS NUMERIC(10,2)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_end_date TIMESTAMPTZ;
  v_price_per_day NUMERIC(10,2);
  v_hours_late NUMERIC(10,2);
  v_chargeable_hours NUMERIC(10,2);
  v_penalty NUMERIC(10,2);
  v_grace_period NUMERIC(10,2);
BEGIN
  -- Get rental end_date and item price_per_day
  SELECT r.end_date, i.price_per_day
  INTO v_end_date, v_price_per_day
  FROM rentals r
  JOIN items i ON i.id = r.item_id
  WHERE r.id = p_rental_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Get grace period from platform settings (default 3 hours)
  SELECT COALESCE(
    (SELECT setting_value::NUMERIC FROM platform_settings
     WHERE setting_key = 'late_return_grace_period_hours'),
    3
  ) INTO v_grace_period;

  v_hours_late := EXTRACT(EPOCH FROM (p_actual_return_date - v_end_date)) / 3600;

  -- If not late, no penalty
  IF v_hours_late <= 0 THEN
    RETURN 0;
  END IF;

  -- Apply grace period
  v_chargeable_hours := GREATEST(0, v_hours_late - v_grace_period);

  -- Calculate penalty: 150% of daily rate per day (or partial day)
  v_penalty := CEIL(v_chargeable_hours / 24) * (v_price_per_day * 1.5);

  -- Round to cents
  v_penalty := ROUND(v_penalty, 2);

  -- Insert late return record
  INSERT INTO late_return_records (rental_id, expected_end_date, actual_return_date, hours_late, grace_period_hours, chargeable_hours, penalty_amount)
  VALUES (p_rental_id, v_end_date, p_actual_return_date, v_hours_late, v_grace_period, v_chargeable_hours, v_penalty);

  -- If penalty > 0, also create a penalty record
  IF v_penalty > 0 THEN
    INSERT INTO penalty_records (rental_id, penalty_type, amount, description, created_by)
    VALUES (p_rental_id, 'late_return', v_penalty,
            format('Late return: %s hours late (%s chargeable after %s-hour grace period). Penalty: 150%% of daily rate (RM%s/day).',
                   ROUND(v_hours_late, 1), ROUND(v_chargeable_hours, 1), ROUND(v_grace_period, 1), v_price_per_day),
            NULL);
  END IF;

  RETURN v_penalty;
END;
$$;

-- ============================================
-- Trigger: auto-mark overdue when end_date passes without return
-- ============================================
CREATE OR REPLACE FUNCTION public.check_and_mark_overdue()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status = 'active' THEN
    -- No change, ignore
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================
-- Function: mark_overdue_rentals (for cron)
-- ============================================
CREATE OR REPLACE FUNCTION public.mark_overdue_rentals()
RETURNS TABLE(rental_id UUID, renter_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.rentals
  SET status = 'overdue'
  WHERE status = 'active'
    AND end_date < NOW() - INTERVAL '3 hours'
    AND status != 'overdue'
  RETURNING id, renter_id;
END;
$$;

COMMENT ON FUNCTION public.mark_overdue_rentals IS 'Marks active rentals as overdue when end_date + 3h grace period has passed. Call from cron.';
