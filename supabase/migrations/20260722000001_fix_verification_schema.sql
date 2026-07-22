-- =============================================================================
-- Fix verification schema: add missing columns, table, and enum values
-- to align local migrations with remote DB state
-- =============================================================================

-- ========================================
-- 1. Add missing columns to verification_requests
-- ========================================
ALTER TABLE verification_requests
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);

-- Drop reviewed_by if it exists (renamed to verified_by)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'verification_requests' AND column_name = 'reviewed_by'
  ) THEN
    ALTER TABLE verification_requests DROP COLUMN reviewed_by;
  END IF;
END $$;

-- ========================================
-- 2. Add missing enum values for notification_type
-- ========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE typname = 'notification_type' AND enumlabel = 'verification_pending'
  ) THEN
    ALTER TYPE public.notification_type ADD VALUE 'verification_pending';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE typname = 'notification_type' AND enumlabel = 'verification_approved'
  ) THEN
    ALTER TYPE public.notification_type ADD VALUE 'verification_approved';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE typname = 'notification_type' AND enumlabel = 'verification_rejected'
  ) THEN
    ALTER TYPE public.notification_type ADD VALUE 'verification_rejected';
  END IF;
END $$;

-- ========================================
-- 3. Create verification_audit_log table (if not exists)
-- ========================================
CREATE TABLE IF NOT EXISTS public.verification_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID NOT NULL REFERENCES public.verification_requests(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.verification_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'verification_audit_log'
    AND policyname = 'Admins can view verification audit logs'
  ) THEN
    CREATE POLICY "Admins can view verification audit logs"
    ON public.verification_audit_log FOR SELECT
    USING (has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Anyone authenticated can insert (edge functions use service_role which bypasses RLS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'verification_audit_log'
    AND policyname = 'System can insert verification audit logs'
  ) THEN
    CREATE POLICY "System can insert verification audit logs"
    ON public.verification_audit_log FOR INSERT
    WITH CHECK (true);
  END IF;
END $$;

-- Index for audit log queries
CREATE INDEX IF NOT EXISTS idx_verification_audit_log_verification_id
  ON public.verification_audit_log(verification_id);
CREATE INDEX IF NOT EXISTS idx_verification_audit_log_performed_by
  ON public.verification_audit_log(performed_by);
