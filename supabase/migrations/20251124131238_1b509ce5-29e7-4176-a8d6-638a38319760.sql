-- Trust & Safety Module: Add pickup code, handover photos, and dispute fields

-- Add new columns to rentals table
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS pickup_code TEXT;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS handover_photos TEXT[] DEFAULT '{}';
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS return_photos TEXT[] DEFAULT '{}';
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS actual_start_at TIMESTAMPTZ;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS dispute_reason TEXT;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS dispute_status TEXT CHECK (dispute_status IN ('open', 'resolved_refund', 'resolved_payout'));
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS is_disputed BOOLEAN DEFAULT FALSE;

-- Add 'disputed' to rental_status enum
ALTER TYPE rental_status ADD VALUE IF NOT EXISTS 'disputed';

-- Create index for pickup codes (for quick lookups)
CREATE INDEX IF NOT EXISTS idx_rentals_pickup_code ON rentals(pickup_code) WHERE pickup_code IS NOT NULL;

-- Create index for disputed rentals
CREATE INDEX IF NOT EXISTS idx_rentals_disputed ON rentals(is_disputed, status) WHERE is_disputed = TRUE;

-- Create rental-evidence storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('rental-evidence', 'rental-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for rental-evidence bucket
CREATE POLICY "Users can upload rental evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'rental-evidence');

CREATE POLICY "Users can view rental evidence"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'rental-evidence');

CREATE POLICY "Users can update their rental evidence"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'rental-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their rental evidence"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'rental-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Update payout release trigger to exclude disputed rentals
CREATE OR REPLACE FUNCTION public.release_held_payout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Only release payout if rental is completed AND not disputed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') AND NEW.is_disputed = FALSE THEN
    
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
$function$;