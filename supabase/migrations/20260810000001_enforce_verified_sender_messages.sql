-- ============================================================================
-- Enforce identity verification on chat messages at the database level.
--
-- Policy (docs/PRODUCT/USER_FLOW.md): unverified users may browse but cannot
-- contact vendors. Previously this was only enforced client-side, so an
-- unverified user could bypass the UI and insert messages directly via the
-- Supabase client.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_sender_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.sender_id AND p.is_verified = TRUE
  ) AND NOT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = NEW.sender_id AND r.role IN ('admin', 'moderator', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Verify your identity to send messages';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_sender_verified ON public.messages;
CREATE TRIGGER trg_messages_sender_verified
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_sender_verified();