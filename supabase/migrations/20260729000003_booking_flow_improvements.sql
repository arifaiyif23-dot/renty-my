-- Phase 4: Booking Flow Improvements
-- 1. booking_events audit trail table
-- 2. Item status auto-update on rental transitions
-- 3. 2-hour vendor approval auto-expiry

-- 1. Create booking_events table (audit trail)
CREATE TABLE IF NOT EXISTS booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID REFERENCES public.rentals(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  old_status rental_status,
  new_status rental_status,
  actor_id UUID REFERENCES public.profiles(id),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rental participants can view booking events"
  ON booking_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rentals
      WHERE rentals.id = booking_events.rental_id
        AND (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
    )
  );

CREATE POLICY "Admins can view all booking events"
  ON booking_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin', 'moderator')
    )
  );

CREATE POLICY "System can insert booking events"
  ON booking_events FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_booking_events_rental_id
  ON booking_events(rental_id, created_at DESC);

-- 2. Item status auto-update on rental transitions
-- When a booking transitions to approved → item becomes RESERVED
-- When a booking transitions to paid → item stays RESERVED
-- When a booking transitions to active → item becomes ACTIVE_RENTAL
-- When a booking transitions to completed → item becomes INSPECTION_PENDING
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
        UPDATE items SET status = 'reserved' WHERE id = NEW.item_id;
      WHEN 'active' THEN
        UPDATE items SET status = 'active_rental' WHERE id = NEW.item_id;
      WHEN 'completed' THEN
        UPDATE items SET status = 'inspection_pending' WHERE id = NEW.item_id;
      WHEN 'cancelled' THEN
        -- Return to available if no other active/pending bookings exist
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

DROP TRIGGER IF EXISTS trg_update_item_status_on_rental ON public.rentals;
CREATE TRIGGER trg_update_item_status_on_rental
  AFTER UPDATE OF status ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_item_status_on_rental_change();

-- 3. Log booking events on every status change
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

DROP TRIGGER IF EXISTS trg_log_booking_event ON public.rentals;
CREATE TRIGGER trg_log_booking_event
  AFTER UPDATE OF status ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.log_booking_event();

-- 4. Auto-expiry: function to check and expire stale pending_approval rentals
CREATE OR REPLACE FUNCTION public.expire_stale_bookings()
RETURNS TABLE(rental_id UUID, item_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.rentals
  SET status = 'cancelled'
  WHERE status = 'pending_approval'
    AND created_at < NOW() - INTERVAL '2 hours'
    AND id IN (
      SELECT r.id FROM public.rentals r
      LEFT JOIN public.booking_events be ON be.rental_id = r.id AND be.event_type = 'status_change'
      WHERE be.id IS NULL
      LIMIT 50
    )
  RETURNING id, item_id;
END;
$$;

COMMENT ON FUNCTION public.expire_stale_bookings IS 'Cancels pending_approval rentals older than 2 hours. Call from cron or cleanup edge function.';
