-- Phase 9: Completion — Inspection, Damage Claims, Review Window
-- SOP: ITEM_LIFECYCLE.md §4, §6 — Inspection Results, Damage Claims

-- ============================================
-- 9.3: damage_claims table
-- ============================================
CREATE TABLE IF NOT EXISTS damage_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID REFERENCES public.rentals(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  filed_by UUID REFERENCES public.profiles(id) NOT NULL,
  claim_type TEXT NOT NULL CHECK (claim_type IN ('damage', 'missing_item', 'excessive_wear', 'other')),
  description TEXT NOT NULL,
  penalty_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  evidence_urls TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE damage_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rental participants can view damage claims"
  ON damage_claims FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rentals
      WHERE rentals.id = damage_claims.rental_id
        AND (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
    )
  );

CREATE POLICY "Admins can view all damage claims"
  ON damage_claims FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "System can manage damage claims"
  ON damage_claims FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_damage_claims_rental_id ON damage_claims(rental_id);

-- ============================================
-- 9.6-9.7: Complete inspection — transition item from inspection_pending
-- ============================================
-- Called by owner/inspector after return inspection.
-- Transitions item based on result and optionally creates damage claim.
CREATE OR REPLACE FUNCTION public.complete_inspection(
  p_item_id UUID,
  p_result TEXT,
  p_claim_type TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_penalty_amount NUMERIC(10,2) DEFAULT 0,
  p_evidence_urls TEXT[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_current_status item_status;
  v_rental_id UUID;
  v_owner_id UUID;
BEGIN
  -- Get current item status
  SELECT status, owner_id INTO v_current_status, v_owner_id
  FROM items WHERE id = p_item_id;

  IF v_current_status IS DISTINCT FROM 'inspection_pending' THEN
    RAISE EXCEPTION 'Item is not in inspection_pending status (current: %)', v_current_status;
  END IF;

  -- Find the most recent completed rental for this item
  SELECT id INTO v_rental_id
  FROM rentals
  WHERE item_id = p_item_id AND status = 'completed'
  ORDER BY updated_at DESC LIMIT 1;

  CASE p_result
    WHEN 'available' THEN
      UPDATE items SET status = 'available' WHERE id = p_item_id;
    WHEN 'maintenance' THEN
      UPDATE items SET status = 'maintenance' WHERE id = p_item_id;
    WHEN 'damaged' THEN
      UPDATE items SET status = 'damaged' WHERE id = p_item_id;
      -- Create damage claim if details provided
      IF p_claim_type IS NOT NULL AND p_description IS NOT NULL THEN
        INSERT INTO damage_claims (rental_id, item_id, filed_by, claim_type, description, penalty_amount, evidence_urls)
        VALUES (v_rental_id, p_item_id, v_owner_id, p_claim_type, p_description, p_penalty_amount, p_evidence_urls);
      END IF;
    ELSE
      RAISE EXCEPTION 'Invalid inspection result: % (valid: available, maintenance, damaged)', p_result;
  END CASE;

  RETURN jsonb_build_object(
    'success', true,
    'new_status', p_result,
    'rental_id', v_rental_id
  );
END;
$$;

-- ============================================
-- 9.5: Review window enforcement — 7 days after rental completion
-- ============================================
CREATE OR REPLACE FUNCTION public.check_review_window()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_completed_at TIMESTAMPTZ;
  v_days_since INTEGER;
BEGIN
  -- Find when the rental was completed
  SELECT updated_at INTO v_completed_at
  FROM rentals
  WHERE id = NEW.rental_id AND status = 'completed';

  IF v_completed_at IS NULL THEN
    RAISE EXCEPTION 'Can only review completed rentals';
  END IF;

  v_days_since := EXTRACT(DAY FROM (NOW() - v_completed_at));

  IF v_days_since > 7 THEN
    RAISE EXCEPTION 'Review window has expired (7 days from rental completion)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_review_window ON public.reviews;
CREATE TRIGGER trg_check_review_window
  BEFORE INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.check_review_window();
