-- Phase 1: Critical Payment & Payout Security Fixes

-- 1. Add critical indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_status_expiry ON payments(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_payouts_owner_status ON payouts(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_rentals_owner_status ON rentals(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_rentals_dates ON rentals(start_date, end_date);

-- 2. Add missing columns for better tracking
ALTER TABLE payments ADD COLUMN IF NOT EXISTS toyyibpay_signature TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS held_reason TEXT;

-- 3. Drop old payout trigger and function (using CASCADE)
DROP TRIGGER IF EXISTS create_payout_on_rental_completion ON rentals CASCADE;
DROP FUNCTION IF EXISTS create_payout_on_rental_completion() CASCADE;

-- 4. Create NEW payout trigger that fires immediately after payment success
CREATE OR REPLACE FUNCTION create_payout_on_payment_success()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rental rentals%ROWTYPE;
  v_bank_account owner_bank_accounts%ROWTYPE;
  v_payout_amount DECIMAL(10,2);
  v_held_reason TEXT;
BEGIN
  -- Only process when payment status changes to 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    
    -- Get rental details
    SELECT * INTO v_rental
    FROM rentals
    WHERE id = NEW.rental_id;
    
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;
    
    -- Calculate payout amount
    v_payout_amount := NEW.rental_amount - NEW.platform_fee;
    
    -- Get owner's bank account
    SELECT * INTO v_bank_account
    FROM owner_bank_accounts
    WHERE user_id = v_rental.owner_id;
    
    -- Determine held reason if any
    v_held_reason := NULL;
    IF NOT FOUND OR v_bank_account.account_number IS NULL THEN
      v_held_reason := 'Owner bank account not configured';
    END IF;
    
    -- Create payout record with 'held' status (will be released when rental completes)
    INSERT INTO payouts (
      rental_id,
      payment_id,
      owner_id,
      rental_amount,
      platform_fee,
      payout_amount,
      bank_name,
      account_number,
      account_holder_name,
      status,
      held_reason
    ) VALUES (
      NEW.rental_id,
      NEW.id,
      v_rental.owner_id,
      NEW.rental_amount,
      NEW.platform_fee,
      v_payout_amount,
      v_bank_account.bank_name,
      v_bank_account.account_number,
      v_bank_account.account_holder_name,
      CASE 
        WHEN v_held_reason IS NOT NULL THEN 'awaiting_bank_details'
        ELSE 'held'
      END,
      v_held_reason
    )
    ON CONFLICT (rental_id) DO NOTHING;
    
    -- Notify owner if bank account is missing
    IF v_held_reason IS NOT NULL THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        link
      ) VALUES (
        v_rental.owner_id,
        'payment_received',
        'Add Bank Account to Receive Payout',
        'Your rental payment has been received, but we need your bank account details to process the payout.',
        '/earnings'
      );
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_payout_on_payment_success
AFTER UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION create_payout_on_payment_success();

-- 5. Add function to release held payout when rental completes
CREATE OR REPLACE FUNCTION release_held_payout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    UPDATE payouts
    SET 
      status = 'pending',
      held_reason = NULL,
      updated_at = NOW()
    WHERE rental_id = NEW.id 
      AND status = 'held';
    
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      link
    ) VALUES (
      NEW.owner_id,
      'payment_received',
      'Payout Ready for Processing',
      'Your rental has been completed and the payout is ready for processing.',
      '/earnings'
    );
    
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER release_held_payout
AFTER UPDATE ON rentals
FOR EACH ROW
EXECUTE FUNCTION release_held_payout();

-- 6. Add function to cleanup expired payments
CREATE OR REPLACE FUNCTION cleanup_expired_payments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE payments
  SET 
    status = 'expired',
    updated_at = NOW()
  WHERE status = 'pending'
    AND expires_at < NOW();
  
  UPDATE rentals
  SET 
    status = 'cancelled',
    updated_at = NOW()
  WHERE id IN (
    SELECT rental_id 
    FROM payments 
    WHERE status = 'expired'
  ) AND status = 'pending';
END;
$$;