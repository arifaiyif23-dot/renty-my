-- Create email_logs table for tracking all sent emails
CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resend_email_id TEXT,
  to_email TEXT NOT NULL,
  subject TEXT,
  template_type TEXT NOT NULL, -- 'rental_request', 'rental_approved', 'rental_paid', 'rental_rejected', 'verification_approved', 'verification_rejected'
  status TEXT NOT NULL DEFAULT 'sent', -- sent, delivered, bounced, complained, opened, clicked
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view email logs
CREATE POLICY "Admins can view all email logs"
ON public.email_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert email logs
CREATE POLICY "System can insert email logs"
ON public.email_logs
FOR INSERT
WITH CHECK (true);

-- System can update email logs (for webhook updates)
CREATE POLICY "System can update email logs"
ON public.email_logs
FOR UPDATE
USING (true);

-- Create index for faster queries
CREATE INDEX idx_email_logs_created_at ON public.email_logs(created_at DESC);
CREATE INDEX idx_email_logs_template_type ON public.email_logs(template_type);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);
CREATE INDEX idx_email_logs_resend_email_id ON public.email_logs(resend_email_id);