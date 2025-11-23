-- Create receipts storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  5242880, -- 5MB limit
  ARRAY['application/pdf']
);

-- RLS policies for receipts bucket
CREATE POLICY "Users can view their own receipts"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'receipts' AND
  (storage.foldername(name))[1] IN (
    SELECT rentals.renter_id::text
    FROM rentals
    INNER JOIN payments ON payments.rental_id = rentals.id
    WHERE payments.id::text = (storage.foldername(name))[2]
    AND (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
  )
);

CREATE POLICY "System can insert receipts"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'receipts');

-- Create workflow_logs table
CREATE TABLE public.workflow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name TEXT NOT NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
  trigger_data JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  response_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on workflow_logs
ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view workflow logs
CREATE POLICY "Admins can view all workflow logs"
ON public.workflow_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- System can insert workflow logs
CREATE POLICY "System can insert workflow logs"
ON public.workflow_logs
FOR INSERT
WITH CHECK (true);

-- System can update workflow logs
CREATE POLICY "System can update workflow logs"
ON public.workflow_logs
FOR UPDATE
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_workflow_logs_updated_at
BEFORE UPDATE ON public.workflow_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_workflow_logs_payment_id ON public.workflow_logs(payment_id);
CREATE INDEX idx_workflow_logs_status ON public.workflow_logs(status);
CREATE INDEX idx_workflow_logs_created_at ON public.workflow_logs(created_at DESC);