-- Create content moderation log table
CREATE TABLE public.content_moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content_type TEXT NOT NULL, -- 'listing_title', 'listing_description'
  blocked_content TEXT NOT NULL,
  detected_keywords TEXT[] NOT NULL,
  action_taken TEXT NOT NULL DEFAULT 'blocked', -- 'blocked', 'flagged'
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_moderation_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all moderation logs
CREATE POLICY "Admins can view moderation logs"
ON public.content_moderation_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- System can insert moderation logs
CREATE POLICY "System can insert moderation logs"
ON public.content_moderation_log
FOR INSERT
WITH CHECK (true);

-- Create index for efficient querying
CREATE INDEX idx_moderation_log_user_id ON public.content_moderation_log(user_id);
CREATE INDEX idx_moderation_log_created_at ON public.content_moderation_log(created_at DESC);