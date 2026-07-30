-- Phase 3.1-3.3: Item Lifecycle Status System
-- SOP: ITEM_LIFECYCLE.md — Full status machine + history tracking
-- Follows: CREATED → UNDER_REVIEW → AVAILABLE → RESERVED → PICKUP_PENDING
--          → ACTIVE_RENTAL → RETURN_PENDING → INSPECTION_PENDING
--          → AVAILABLE / MAINTENANCE / DAMAGED / LOST

-- 1. Create item_status ENUM matching SOP lifecycle
DO $$ BEGIN
  CREATE TYPE item_status AS ENUM (
    'created',
    'under_review',
    'available',
    'paused',
    'reserved',
    'pickup_pending',
    'active_rental',
    'return_pending',
    'inspection_pending',
    'maintenance',
    'damaged',
    'lost'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add new status column (keep old columns for back-compat during migration)
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS status item_status NOT NULL DEFAULT 'created';

-- 3. Migrate existing data: map listing_status + is_available to new status
UPDATE items
SET status = CASE
  WHEN listing_status = 'archived' THEN 'lost'::item_status
  WHEN listing_status = 'paused' THEN 'paused'::item_status
  WHEN listing_status = 'draft' THEN 'created'::item_status
  WHEN is_available = true THEN 'available'::item_status
  ELSE 'paused'::item_status
END
WHERE status = 'created';

-- 4. Create item_status_history table
CREATE TABLE IF NOT EXISTS item_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  old_status item_status,
  new_status item_status NOT NULL,
  changed_by UUID REFERENCES public.profiles(id),
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE item_status_history ENABLE ROW LEVEL SECURITY;

-- Allow item owners to view their own status history
CREATE POLICY "Item owners can view status history"
  ON item_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM items
      WHERE items.id = item_status_history.item_id
        AND items.owner_id = auth.uid()
    )
  );

-- Allow admins to view all status history
CREATE POLICY "Admins can view all status history"
  ON item_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin', 'moderator')
    )
  );

-- Allow system (service_role) to insert
CREATE POLICY "System can insert status history"
  ON item_status_history FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_item_status_history_item_id
  ON item_status_history(item_id, created_at DESC);

-- 5. Status transition validation function
CREATE OR REPLACE FUNCTION public.check_item_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Define allowed transitions
    IF NOT (
      (OLD.status = 'created' AND NEW.status IN ('under_review')) OR
      (OLD.status = 'under_review' AND NEW.status IN ('available', 'maintenance', 'created')) OR
      (OLD.status = 'available' AND NEW.status IN ('paused', 'reserved')) OR
      (OLD.status = 'paused' AND NEW.status IN ('available')) OR
      (OLD.status = 'reserved' AND NEW.status IN ('pickup_pending', 'available')) OR
      (OLD.status = 'pickup_pending' AND NEW.status IN ('active_rental', 'available')) OR
      (OLD.status = 'active_rental' AND NEW.status IN ('return_pending', 'maintenance')) OR
      (OLD.status = 'return_pending' AND NEW.status IN ('inspection_pending')) OR
      (OLD.status = 'inspection_pending' AND NEW.status IN ('available', 'maintenance', 'damaged')) OR
      (OLD.status = 'maintenance' AND NEW.status IN ('available', 'damaged')) OR
      (OLD.status = 'damaged' AND NEW.status IN ('maintenance', 'available')) OR
      (NEW.status = 'lost')  -- ANY → LOST
    ) THEN
      RAISE EXCEPTION 'Invalid item status transition: % → %', OLD.status, NEW.status
        USING HINT = format('Item %s cannot transition from %s to %s', NEW.id, OLD.status, NEW.status);
    END IF;

    -- Log to history
    INSERT INTO item_status_history (item_id, old_status, new_status, changed_by, reason, metadata)
    VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      NEW.status,
      jsonb_build_object(
        'trigger', TG_NAME,
        'timestamp', NOW()
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 6. Trigger to enforce status transitions and log history
DROP TRIGGER IF EXISTS trg_check_item_status ON items;
CREATE TRIGGER trg_check_item_status
  BEFORE UPDATE OF status ON items
  FOR EACH ROW
  EXECUTE FUNCTION public.check_item_status_transition();

-- 7. Update indexes
DROP INDEX IF EXISTS idx_items_is_available_created_at;
DROP INDEX IF EXISTS idx_items_category_is_available;
DROP INDEX IF EXISTS idx_items_owner_listing_status_created_at;

CREATE INDEX IF NOT EXISTS idx_items_status ON public.items(status)
  WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_items_owner_status ON public.items(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_items_status_created ON public.items(status, created_at DESC);
