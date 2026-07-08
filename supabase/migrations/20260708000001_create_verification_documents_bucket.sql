-- Create verification-documents storage bucket (missed from original migrations)
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-documents', 'verification-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Only the owning user can read their own documents
CREATE POLICY "Users can view own verification documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'verification-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Authenticated users can upload to their own folder
CREATE POLICY "Users can upload verification documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'verification-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admins can view all verification documents
CREATE POLICY "Admins can view all verification documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'verification-documents' AND has_role(auth.uid(), 'admin'::app_role));
