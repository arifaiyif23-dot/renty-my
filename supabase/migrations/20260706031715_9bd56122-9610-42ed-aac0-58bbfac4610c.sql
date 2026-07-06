-- Enable Realtime for profiles so the verified badge updates without refresh after admin approval
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'verification_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.verification_requests;
  END IF;
END $$;

-- Ensure UPDATE payloads carry full row (needed for reliable realtime merges)
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.verification_requests REPLICA IDENTITY FULL;