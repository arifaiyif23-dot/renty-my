-- Seed admin role for initial platform admin
-- NOTE: Admin email should be configured via environment variable in production.
-- This migration is for initial setup only; use Supabase Dashboard for ongoing admin management.
-- Deprecated: Use admin seeding via ADMIN_EMAIL env variable instead.
DO $$
DECLARE
  admin_uid UUID;
  admin_email TEXT := current_setting('app.admin_email', true);
BEGIN
  IF admin_email IS NULL OR admin_email = '' THEN
    RAISE NOTICE 'app.admin_email not set. Skipping admin seed.';
    RETURN;
  END IF;
  SELECT id INTO admin_uid FROM auth.users WHERE email = admin_email;
  IF admin_uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_uid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;
