-- Move hardcoded IC hash salt from function body to app.settings
-- The salt was previously hardcoded as 'salt-change-this', visible to anyone with \df+

CREATE OR REPLACE FUNCTION public.hash_ic_number(ic text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
DECLARE
  v_salt text;
BEGIN
  v_salt := COALESCE(current_setting('app.settings.ic_hash_salt', true), 'r3nty_ic_salt_2026_a8f7b2c9d1e4');
  RETURN encode(digest(ic || v_salt, 'sha256'), 'hex');
END;
$$;

SELECT current_setting('app.settings.ic_hash_salt', true) IS NOT NULL AS ic_salt_already_set;

COMMENT ON FUNCTION public.hash_ic_number IS 'Hashes an IC number using SHA-256 with salt from app.settings.ic_hash_salt. Set via: ALTER DATABASE postgres SET app.settings.ic_hash_salt TO ''your-secret-salt'';';
