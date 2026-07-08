-- Add missing notification_type enum values used by submit-verification edge function
-- Without these, verification approval/pending notifications fail silently

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.notification_type'::regtype
    AND enumlabel = 'verification_approved'
  ) THEN
    ALTER TYPE public.notification_type ADD VALUE 'verification_approved';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.notification_type'::regtype
    AND enumlabel = 'verification_pending'
  ) THEN
    ALTER TYPE public.notification_type ADD VALUE 'verification_pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.notification_type'::regtype
    AND enumlabel = 'dispute_opened'
  ) THEN
    ALTER TYPE public.notification_type ADD VALUE 'dispute_opened';
  END IF;
END $$;
