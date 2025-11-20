-- Emergency Fix: Drop hardcoded withdrawal constraint to allow dynamic settings
ALTER TABLE withdrawal_requests DROP CONSTRAINT IF EXISTS check_minimum_withdrawal;

-- Add comment for clarity
COMMENT ON TABLE withdrawal_requests IS 'Withdrawal constraints now enforced via platform_settings table';