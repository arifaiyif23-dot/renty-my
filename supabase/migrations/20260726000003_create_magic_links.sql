-- Create magic_links table for custom magic link flow
-- Bypasses Supabase OTP (requires Pro plan) by generating our own tokens
-- and sending them via Resend

CREATE TABLE IF NOT EXISTS public.magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_magic_links_token ON public.magic_links(token);
CREATE INDEX IF NOT EXISTS idx_magic_links_email_created ON public.magic_links(email, created_at DESC);

ALTER TABLE public.magic_links ENABLE ROW LEVEL SECURITY;

-- Cleanup expired tokens periodically (runs every 30 min via pg_cron)
SELECT cron.schedule(
  'cleanup-magic-links',
  '0 */6 * * *',
  $$DELETE FROM public.magic_links WHERE expires_at < now() - interval '1 day'$$
);
