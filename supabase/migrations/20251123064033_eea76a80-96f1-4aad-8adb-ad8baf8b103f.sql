-- ========================================
-- COMPLETE PAYMENT SYSTEM REMOVAL
-- Return to basic booking platform
-- ========================================

-- Drop all payment-related tables
DROP TABLE IF EXISTS payment_reviews CASCADE;
DROP TABLE IF EXISTS payment_milestones CASCADE;
DROP TABLE IF EXISTS payment_holds CASCADE;
DROP TABLE IF EXISTS payment_locks CASCADE;
DROP TABLE IF EXISTS payment_processing_log CASCADE;
DROP TABLE IF EXISTS payment_audit_log CASCADE;
DROP TABLE IF EXISTS payouts CASCADE;
DROP TABLE IF EXISTS owner_earnings CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;

-- Remove payment-related functions
DROP FUNCTION IF EXISTS acquire_payment_lock(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS release_payment_lock(uuid) CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_payment_locks() CASCADE;

-- Clean up rentals table - remove payment columns
ALTER TABLE rentals 
  DROP COLUMN IF EXISTS payment_status CASCADE,
  DROP COLUMN IF EXISTS payment_method CASCADE,
  DROP COLUMN IF EXISTS toyyibpay_bill_code CASCADE,
  DROP COLUMN IF EXISTS owner_confirmed_completion CASCADE,
  DROP COLUMN IF EXISTS renter_confirmed_completion CASCADE;

-- Remove payment-related settings
DELETE FROM platform_settings 
WHERE key IN (
  'earnings_hold_days',
  'min_payout_amount',
  'max_payout_amount',
  'auto_payout_enabled',
  'min_topup_amount',
  'max_topup_amount',
  'enable_auto_escrow_release',
  'withdrawal_processing_fee',
  'enable_auto_payout_approval'
);