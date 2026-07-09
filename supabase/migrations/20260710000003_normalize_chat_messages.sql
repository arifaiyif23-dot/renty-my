-- Normalize chat_sessions.messages JSONB[] into a separate chat_messages table

-- 1. Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Migrate existing data from chat_sessions.messages array into chat_messages
INSERT INTO public.chat_messages (session_id, role, content, metadata, created_at)
SELECT
  cs.id AS session_id,
  (msg->>'role')::TEXT AS role,
  (msg->>'content')::TEXT AS content,
  (msg - 'role' - 'content')::JSONB AS metadata,
  COALESCE(
    (msg->>'created_at')::TIMESTAMPTZ,
    (msg->>'timestamp')::TIMESTAMPTZ,
    cs.created_at
  ) AS created_at
FROM public.chat_sessions cs
CROSS JOIN LATERAL unnest(cs.messages) AS msg
WHERE cs.messages IS NOT NULL AND array_length(cs.messages, 1) > 0;

-- 3. Drop the JSONB[] messages column from chat_sessions
ALTER TABLE public.chat_sessions DROP COLUMN IF EXISTS messages;

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(session_id, created_at);

-- 5. Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for chat_messages (mirror chat_sessions policies)
CREATE POLICY "Users can view own chat messages"
ON public.chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_sessions
    WHERE chat_sessions.id = chat_messages.session_id
    AND chat_sessions.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own chat messages"
ON public.chat_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_sessions
    WHERE chat_sessions.id = chat_messages.session_id
    AND chat_sessions.user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage all chat messages"
ON public.chat_messages
FOR ALL
USING (true)
WITH CHECK (true);

-- 7. Trigger to update chat_sessions.updated_at on new message
CREATE OR REPLACE FUNCTION public.touch_chat_session_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_sessions SET updated_at = NOW() WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS touch_chat_session_on_message ON public.chat_messages;

CREATE TRIGGER touch_chat_session_on_message
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.touch_chat_session_on_message();
