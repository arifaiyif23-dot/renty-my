-- Add constraint to prevent negative wallet balance
ALTER TABLE wallets 
DROP CONSTRAINT IF EXISTS positive_balance;

ALTER TABLE wallets 
ADD CONSTRAINT positive_balance 
CHECK (balance >= 0);

-- Add index for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_wallet_tx_billcode 
ON wallet_transactions(toyyibpay_transaction_id)
WHERE status = 'pending';

-- Add completed_at timestamp for monitoring
ALTER TABLE wallet_transactions
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- Create trigger to set completed_at when status changes to completed
CREATE OR REPLACE FUNCTION set_transaction_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transaction_completed_trigger ON wallet_transactions;
CREATE TRIGGER transaction_completed_trigger
  BEFORE UPDATE ON wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_transaction_completed_at();