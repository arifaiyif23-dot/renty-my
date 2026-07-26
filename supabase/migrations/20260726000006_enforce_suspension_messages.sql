-- ============================================================================
-- Enforce account suspension on chat messages at the database level.
--
-- Previously the messages INSERT policy only checked auth.uid() = sender_id,
-- and the suspension check was purely client-side (Messages.tsx). A suspended
-- user could bypass the UI and insert messages directly via the Supabase
-- client. This trigger raises an exception for suspended senders.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_sender_not_suspended()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.check_user_not_suspended(NEW.sender_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_sender_not_suspended ON public.messages;
CREATE TRIGGER trg_messages_sender_not_suspended
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_sender_not_suspended();
