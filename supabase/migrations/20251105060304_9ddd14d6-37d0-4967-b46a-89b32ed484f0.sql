-- Fix function search path for update_chat_sessions_updated_at
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
DROP FUNCTION IF EXISTS update_chat_sessions_updated_at();

CREATE OR REPLACE FUNCTION update_chat_sessions_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_chat_sessions_updated_at
BEFORE UPDATE ON chat_sessions
FOR EACH ROW
EXECUTE FUNCTION update_chat_sessions_updated_at();