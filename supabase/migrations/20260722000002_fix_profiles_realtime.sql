-- Ensure profiles table has REPLICA IDENTITY FULL so Realtime payloads
-- include all columns (especially is_verified, verification_level)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'profiles'
    AND c.relreplident = 'f'  -- 'f' = FULL
  ) THEN
    ALTER TABLE public.profiles REPLICA IDENTITY FULL;
  END IF;
END $$;
