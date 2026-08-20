-- ============================================================================
-- Fasa A (2026-08-20): hash_ic_number reads a GUC (app.settings.ic_hash_salt),
-- so IMMUTABLE is incorrect and could cache stale results in expressions.
-- Mark it STABLE. No index/generated-column depends on the IMMUTABLE marker.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hash_ic_number(ic text)
RETURNS text
LANGUAGE plpgsql STABLE SET search_path = extensions, public
AS $$
DECLARE
  v_salt text;
BEGIN
  v_salt := COALESCE(current_setting('app.settings.ic_hash_salt', true), 'r3nty_ic_salt_2026_a8f7b2c9d1e4');
  RETURN encode(digest(ic || v_salt, 'sha256'::text), 'hex');
END;
$$;

COMMENT ON FUNCTION public.hash_ic_number IS 'Hashes an IC number using SHA-256 with salt from app.settings.ic_hash_salt. Set via: ALTER DATABASE postgres SET app.settings.ic_hash_salt TO ''your-secret-salt'';';