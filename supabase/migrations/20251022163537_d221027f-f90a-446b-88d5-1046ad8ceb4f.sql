-- Add payment fields to rentals table
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded'));
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS toyyibpay_bill_code TEXT;

-- Add transaction reference to wallet_transactions
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS toyyibpay_transaction_id TEXT;