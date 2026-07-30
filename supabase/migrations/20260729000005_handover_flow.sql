-- Phase 6: Handover & Pickup Flow
-- SOP: ITEM_LIFECYCLE.md §2 — Handover Confirmation
-- 6.1: Update trigger: paid → pickup_pending (instead of reserved)
-- 6.6: No-show cancellation for unattended pickups

-- ============================================
-- 6.1: Update item status trigger for paid → pickup_pending
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
-- 6.6: Failed pickup (no-show) handling
-- ============================================
-- Cancels paid rentals where start_date + 24h has passed without handover
CREATE OR REPLACE FUNCTION public.cancel_no_show_rentals()
RETURNS TABLE(rental_id UUID, item_id UUID, renter_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.rentals
  SET status = 'cancelled'
  WHERE status = 'paid'
    AND start_date + INTERVAL '24 hours' < NOW()
    AND actual_start_at IS NULL
  RETURNING id, item_id, renter_id;
END;
$$;

COMMENT ON FUNCTION public.cancel_no_show_rentals IS 'Cancels paid rentals where start_date + 24h passed with no handover. Call from cron or cleanup edge function.';
