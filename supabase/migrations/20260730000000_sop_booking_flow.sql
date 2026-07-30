-- Phase A: SOP Booking Flow (DB Migration)
-- Align rental_status ENUM with SOP: DRAFT → REQUESTED → PAYMENT_PENDING → RESERVED → CONFIRMED → ACTIVE
-- Payment flows BEFORE owner approval (reverse of legacy flow)

-- ============================================
-- Step 1: Drop all triggers & policies referencing rentals.status
-- ============================================
-- Drop all triggers on rentals (we recreate SOP-compliant ones later)
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT trigger_name, event_object_table, trigger_schema
    FROM information_schema.triggers
    WHERE event_object_table = 'rentals' AND trigger_schema = 'public'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', rec.trigger_name, rec.trigger_schema, rec.event_object_table);
  END LOOP;
END;
$$
LANGUAGE plpgsql;

-- Drop all policies referencing rentals.status
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT p.policyname, p.tablename, p.schemaname
    FROM pg_policies p
    WHERE p.qual::text LIKE '%rentals.status%'
       OR p.with_check::text LIKE '%rentals.status%'
  LOOP
    RAISE NOTICE 'Dropping policy % on %.%', rec.policyname, rec.schemaname, rec.tablename;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.policyname, rec.schemaname, rec.tablename);
  END LOOP;
END;
$$
LANGUAGE plpgsql;

-- ============================================
-- Step 2: Drop functions that reference rental_status values directly
-- These will be recreated with new SOP values after type migration
-- ============================================
DROP FUNCTION IF EXISTS public.check_rental_status_transition();
DROP FUNCTION IF EXISTS public.update_item_status_on_rental_change();
DROP FUNCTION IF EXISTS public.log_booking_event();
DROP FUNCTION IF EXISTS public.create_payout_on_rental_complete();

-- ============================================
-- Step 3: Create new SOP-compliant ENUM
-- ============================================
CREATE TYPE rental_status_new AS ENUM (
  'draft', 'requested', 'payment_pending', 'reserved', 'confirmed',
  'rejected', 'active', 'completed', 'cancelled', 'disputed', 'overdue'
);

-- ============================================
-- Step 4: Migrate rentals.status to new ENUM
-- ============================================
ALTER TABLE public.rentals
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE rental_status_new
  USING (
    CASE status::text
      WHEN 'pending_approval' THEN 'requested'::rental_status_new
      WHEN 'approved' THEN 'confirmed'::rental_status_new
      WHEN 'paid' THEN 'reserved'::rental_status_new
      WHEN 'pending' THEN 'requested'::rental_status_new
      ELSE status::text::rental_status_new
    END
  );
ALTER TABLE public.rentals ALTER COLUMN status SET DEFAULT 'draft'::rental_status_new;

-- ============================================
-- Step 5: Migrate booking_events columns to new ENUM
-- ============================================
ALTER TABLE public.booking_events
  ALTER COLUMN old_status TYPE rental_status_new
  USING (
    CASE old_status::text
      WHEN 'pending_approval' THEN 'requested'::rental_status_new
      WHEN 'approved' THEN 'confirmed'::rental_status_new
      WHEN 'paid' THEN 'reserved'::rental_status_new
      WHEN 'pending' THEN 'requested'::rental_status_new
      ELSE old_status::text::rental_status_new
    END
  );

ALTER TABLE public.booking_events
  ALTER COLUMN new_status TYPE rental_status_new
  USING (
    CASE new_status::text
      WHEN 'pending_approval' THEN 'requested'::rental_status_new
      WHEN 'approved' THEN 'confirmed'::rental_status_new
      WHEN 'paid' THEN 'reserved'::rental_status_new
      WHEN 'pending' THEN 'requested'::rental_status_new
      ELSE new_status::text::rental_status_new
    END
  );

-- ============================================
-- Step 6: Drop legacy ENUM, rename new one
-- ============================================
DROP TYPE public.rental_status;
ALTER TYPE public.rental_status_new RENAME TO rental_status;

-- ============================================
-- Step 7: Recreate transition guard with SOP transitions
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
    (OLD.status = 'draft' AND NEW.status = 'requested') OR
    (OLD.status = 'requested' AND NEW.status IN ('payment_pending', 'cancelled')) OR
    (OLD.status = 'payment_pending' AND NEW.status IN ('reserved', 'cancelled')) OR
    (OLD.status = 'reserved' AND NEW.status IN ('confirmed', 'cancelled')) OR
    (OLD.status = 'confirmed' AND NEW.status IN ('active', 'cancelled')) OR
    (OLD.status = 'active' AND NEW.status IN ('completed', 'disputed', 'overdue')) OR
    (OLD.status = 'overdue' AND NEW.status IN ('completed', 'disputed')) OR
    (OLD.status = 'disputed' AND NEW.status IN ('completed', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'Invalid rental status transition: % -> %', OLD.status, NEW.status
      USING HINT = 'SOP: draft→requested→payment_pending→reserved→confirmed→active. Valid transitions: draft→requested, requested→payment_pending/cancelled, payment_pending→reserved/cancelled, reserved→confirmed/cancelled, confirmed→active/cancelled, active→completed/disputed/overdue, overdue→completed/disputed, disputed→completed/cancelled';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rental_status_transition
  BEFORE UPDATE OF status ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.check_rental_status_transition();

-- ============================================
-- Step 8: Recreate item status mapper with SOP mappings
-- ============================================
CREATE OR REPLACE FUNCTION public.update_item_status_on_rental_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'requested' THEN
        -- No item change; still available for overlap detection
      WHEN 'reserved' THEN
        UPDATE items SET status = 'reserved' WHERE id = NEW.item_id;
      WHEN 'confirmed' THEN
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
              AND status IN ('requested', 'payment_pending', 'reserved', 'confirmed', 'active')
              AND id != NEW.id
          );
      WHEN 'rejected' THEN
        UPDATE items SET status = 'available'
        WHERE id = NEW.item_id
          AND NOT EXISTS (
            SELECT 1 FROM rentals
            WHERE item_id = NEW.item_id
              AND status IN ('requested', 'payment_pending', 'reserved', 'confirmed', 'active')
              AND id != NEW.id
          );
      ELSE
        -- No item status change
    END CASE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_item_status_on_rental
  AFTER UPDATE OF status ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_item_status_on_rental_change();

-- ============================================
-- Step 9: Recreate booking event logger
-- ============================================
CREATE OR REPLACE FUNCTION public.log_booking_event()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO booking_events (rental_id, event_type, old_status, new_status, actor_id)
    VALUES (NEW.id, 'status_change', OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_booking_event
  AFTER UPDATE OF status ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.log_booking_event();

-- ============================================
-- Step 10: Recreate auto-payout trigger (no logic change)
-- ============================================
CREATE OR REPLACE FUNCTION public.create_payout_on_rental_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_payout_amount NUMERIC;
BEGIN
  IF NEW.status <> 'completed' OR (OLD.status IS NOT DISTINCT FROM 'completed') THEN
    RETURN NEW;
  END IF;

  SELECT id, rental_amount, platform_fee
    INTO v_payment
  FROM public.payments
  WHERE rental_id = NEW.id
    AND status = 'paid'
  ORDER BY paid_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_payout_amount := GREATEST(0, COALESCE(v_payment.rental_amount, 0) - COALESCE(v_payment.platform_fee, 0));

  INSERT INTO public.payouts (
    owner_id, payment_id, rental_id, rental_amount, platform_fee, payout_amount, status
  ) VALUES (
    NEW.owner_id, v_payment.id, NEW.id,
    COALESCE(v_payment.rental_amount, 0),
    COALESCE(v_payment.platform_fee, 0),
    v_payout_amount, 'pending'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payout_on_rental_complete
  AFTER UPDATE OF status ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.create_payout_on_rental_complete();

-- ============================================
-- Step 11: Update create_rental_with_overlap_check RPC
-- ============================================
CREATE OR REPLACE FUNCTION public.create_rental_with_overlap_check(
  p_item_id UUID,
  p_renter_id UUID,
  p_owner_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_total_price DECIMAL,
  p_status TEXT DEFAULT 'requested'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rental_id UUID;
  v_overlap_count INT;
  v_lock_key INT;
BEGIN
  v_lock_key := ('x' || substr(md5(p_item_id::text), 1, 8))::bit(32)::int;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COUNT(*) INTO v_overlap_count
  FROM public.rentals
  WHERE item_id = p_item_id
    AND status IN ('payment_pending', 'reserved', 'confirmed', 'active')
    AND start_date <= p_end_date
    AND end_date >= p_start_date;

  IF v_overlap_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item is not available for the selected dates');
  END IF;

  INSERT INTO public.rentals (item_id, renter_id, owner_id, start_date, end_date, total_price, status)
  VALUES (p_item_id, p_renter_id, p_owner_id, p_start_date, p_end_date, p_total_price, p_status::rental_status)
  RETURNING id INTO v_rental_id;

  RETURN jsonb_build_object('success', true, 'rental_id', v_rental_id);
END;
$$;

-- ============================================
-- Step 12: Update expire_stale_bookings for SOP status names
-- ============================================
CREATE OR REPLACE FUNCTION public.expire_stale_bookings()
RETURNS TABLE(rental_id UUID, item_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.rentals
  SET status = 'cancelled'
  WHERE (
    (status = 'requested' AND created_at < NOW() - INTERVAL '30 minutes') OR
    (status = 'payment_pending' AND updated_at < NOW() - INTERVAL '30 minutes') OR
    (status = 'reserved' AND updated_at < NOW() - INTERVAL '48 hours')
  )
  RETURNING id, item_id
  LIMIT 50;
END;
$$;

COMMENT ON FUNCTION public.expire_stale_bookings IS 'Expires stale bookings: requested→30min, payment_pending→30min, reserved (unconfirmed)→48h. Call from cron.';

-- ============================================
-- Step 13: Update cancel_no_show_rentals for SOP (confirmed → no-show)
-- ============================================
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
    AND start_date + INTERVAL '24 hours' < NOW()
    AND actual_start_at IS NULL
  RETURNING id, item_id, renter_id;
END;
$$;

COMMENT ON FUNCTION public.cancel_no_show_rentals IS 'Cancels confirmed rentals where start_date + 24h passed with no handover. Call from cron.';

-- ============================================
-- Step 14: Update RLS policy on profiles for SOP status names
-- ============================================
DROP POLICY IF EXISTS "Rental participants can view each other's profiles" ON public.profiles;
CREATE POLICY "Rental participants can view each other's profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.rentals
      WHERE (renter_id = auth.uid() OR owner_id = auth.uid())
        AND (profiles.id = rentals.renter_id OR profiles.id = rentals.owner_id)
        AND status NOT IN ('draft', 'cancelled', 'rejected')
    )
    AND (profiles.is_deleted IS NOT TRUE OR profiles.is_deleted IS NULL)
  );

-- ============================================
-- Step 15: Recreate policies that reference rentals.status
-- ============================================
CREATE POLICY "Users can create reviews for their completed rentals" ON public.reviews FOR INSERT WITH CHECK (
  auth.uid() = reviewer_id AND
  EXISTS (
    SELECT 1 FROM public.rentals
    WHERE rentals.id = reviews.rental_id
    AND rentals.status = 'completed'
    AND (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
  )
);

-- ============================================
-- Step 16: Verify migration
-- ============================================
DO $$
DECLARE
  v_type_name TEXT;
BEGIN
  SELECT t.typname INTO v_type_name
  FROM pg_type t
  WHERE t.typname = 'rental_status';

  IF v_type_name IS NULL THEN
    RAISE EXCEPTION 'rental_status type not found after migration';
  END IF;

  RAISE NOTICE 'SOP booking flow migration complete. New rental_status ENUM has 11 values.';
END;
$$;
