-- Phase 3: Cron Job Setup
-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Phase 4: Escrow Triggers

-- Trigger to set auto_release_at when rental is completed and both parties confirm
CREATE OR REPLACE FUNCTION set_escrow_auto_release()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if rental is completed and both parties have confirmed
  IF NEW.status = 'completed' 
     AND NEW.owner_confirmed_completion = true 
     AND NEW.renter_confirmed_completion = true 
     AND (OLD.owner_confirmed_completion = false OR OLD.renter_confirmed_completion = false)
  THEN
    -- Set auto-release timer to 24 hours from now
    UPDATE escrow_accounts
    SET auto_release_at = NOW() + INTERVAL '24 hours',
        updated_at = NOW()
    WHERE rental_id = NEW.id
      AND status = 'held';
      
    -- Log the auto-release scheduling
    INSERT INTO payment_processing_log (rental_id, user_id, action, details)
    VALUES (
      NEW.id,
      NEW.renter_id,
      'escrow_auto_release_scheduled',
      jsonb_build_object(
        'auto_release_at', NOW() + INTERVAL '24 hours',
        'message', 'Both parties confirmed completion, escrow will auto-release in 24 hours'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_escrow_auto_release
  AFTER UPDATE ON rentals
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION set_escrow_auto_release();

-- Phase 9: Database Optimizations

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_escrow_auto_release 
ON escrow_accounts(auto_release_at) 
WHERE status = 'held';

CREATE INDEX IF NOT EXISTS idx_escrow_rental 
ON escrow_accounts(rental_id);

CREATE INDEX IF NOT EXISTS idx_escrow_status 
ON escrow_accounts(status) 
WHERE status = 'held';

CREATE INDEX IF NOT EXISTS idx_disputes_rental 
ON disputes(rental_id, status);

CREATE INDEX IF NOT EXISTS idx_disputes_status 
ON disputes(status) 
WHERE status IN ('open', 'investigating');

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type 
ON wallet_transactions(type, status);

CREATE INDEX IF NOT EXISTS idx_rentals_completion 
ON rentals(status, owner_confirmed_completion, renter_confirmed_completion)
WHERE status IN ('active', 'completed');

-- Add payment_status column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rentals' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE rentals ADD COLUMN payment_status TEXT DEFAULT 'pending';
  END IF;
END $$;

-- Add helpful comments
COMMENT ON TABLE escrow_accounts IS 'Holds rental payments in escrow until completion and grace period';
COMMENT ON COLUMN escrow_accounts.auto_release_at IS 'Timestamp when payment will automatically release to owner';
COMMENT ON COLUMN escrow_accounts.status IS 'held = in escrow, released = paid to owner, disputed = frozen, refunded = returned to renter';

COMMENT ON TABLE disputes IS 'Tracks disputes between renters and owners, freezes escrow when filed';
COMMENT ON COLUMN disputes.status IS 'open = just filed, investigating = admin reviewing, resolved = decision made';

-- Add check constraints
ALTER TABLE escrow_accounts
DROP CONSTRAINT IF EXISTS check_escrow_amounts,
ADD CONSTRAINT check_escrow_amounts 
CHECK (total_amount = platform_fee + owner_payout);

ALTER TABLE escrow_accounts
DROP CONSTRAINT IF EXISTS check_escrow_status,
ADD CONSTRAINT check_escrow_status 
CHECK (status IN ('held', 'released', 'disputed', 'refunded', 'partial_release'));

ALTER TABLE disputes
DROP CONSTRAINT IF EXISTS check_dispute_status,
ADD CONSTRAINT check_dispute_status 
CHECK (status IN ('open', 'investigating', 'resolved', 'escalated', 'closed'));

-- Update freeze_escrow_on_dispute trigger to also log
CREATE OR REPLACE FUNCTION freeze_escrow_on_dispute()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Freeze escrow when dispute is filed
  UPDATE escrow_accounts
  SET status = 'disputed',
      updated_at = NOW()
  WHERE rental_id = NEW.rental_id
    AND status = 'held';
  
  -- Log the freeze
  INSERT INTO payment_processing_log (rental_id, user_id, action, details)
  VALUES (
    NEW.rental_id,
    NEW.filed_by,
    'escrow_frozen_dispute',
    jsonb_build_object(
      'dispute_id', NEW.id,
      'dispute_type', NEW.dispute_type,
      'filed_by', NEW.filed_by,
      'message', 'Escrow frozen due to dispute filing'
    )
  );
  
  RETURN NEW;
END;
$$;