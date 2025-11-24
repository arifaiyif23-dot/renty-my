-- Step 1: Add new enum values to rental_status
-- Add new statuses: pending_approval, approved, rejected, paid

ALTER TYPE rental_status ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE rental_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE rental_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE rental_status ADD VALUE IF NOT EXISTS 'paid';

-- Add comment explaining the new flow
COMMENT ON TYPE rental_status IS 'Rental workflow: pending_approval -> approved -> paid -> active -> completed. Can be rejected or cancelled at any stage.';

-- Add indexes for faster queries on rental status
CREATE INDEX IF NOT EXISTS idx_rentals_status_renter ON rentals(status, renter_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status_owner ON rentals(status, owner_id);