-- ============================================================================
-- B5 follow-up (2026-08-20): IC hash salt hardening.
--
-- Problem: hash_ic_number() fell back to a PUBLICLY-KNOWN salt
-- ('r3nty_ic_salt_2026_...', committed in migrations/git history) whenever the
-- app.settings.ic_hash_salt GUC was unset. On prod the GUC was NULL, so every
-- ic_number_hash / identity_number_hash was computed with a known salt and is
-- trivially brute-forceable offline (SHA-256 over the structured 12-digit IC
-- space). Plaintext ICs were already dropped, so legacy hashes cannot be
-- re-hashed.
--
-- Fix:
--   1. Generate a strong random 32-byte salt at migration time and store it
--      durably in platform_settings (same pattern as encryption_key — the
--      pgBouncer-safe source of truth, since the GUC can be reset between
--      statements under transaction pooling).
--   2. hash_ic_number() now prefers the GUC, then platform_settings, and FAILS
--      CLOSED (raises) if neither is configured. No known-salt fallback.
--   3. NULL out legacy hashes computed with the public salt. No application
--      code SELECTs by these hashes (verified: no duplicate-IC check), so this
--      removes the exposure with no functional loss.
-- ============================================================================

DO $$
DECLARE
  v_salt text := encode(extensions.gen_random_bytes(32), 'base64');
BEGIN
  INSERT INTO platform_settings (key, value, description, updated_at)
    VALUES (
      'ic_hash_salt',
      to_jsonb(v_salt),
      'Random salt for public.hash_ic_number (generated 2026-08-20; replaces the publicly-known fallback salt).',
      now()
    )
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.hash_ic_number(ic text)
RETURNS text
LANGUAGE plpgsql STABLE SET search_path = extensions, public
AS $$
DECLARE
  v_salt text;
BEGIN
  v_salt := NULLIF(current_setting('app.settings.ic_hash_salt', true), '');
  IF v_salt IS NULL THEN
    SELECT btrim(value::text, '"') INTO v_salt FROM platform_settings WHERE key = 'ic_hash_salt';
  END IF;
  IF v_salt IS NULL OR v_salt = '' THEN
    RAISE EXCEPTION 'ic_hash_salt is not configured (set platform_settings.ic_hash_salt)';
  END IF;
  RETURN encode(digest(ic || v_salt, 'sha256'::text), 'hex');
END;
$$;

COMMENT ON FUNCTION public.hash_ic_number IS 'Hashes an IC number using SHA-256 with a salt from app.settings.ic_hash_salt (GUC) or platform_settings.ic_hash_salt. Fails closed if neither is configured.';

-- Remove legacy hashes computed with the publicly-known salt (trivially
-- reversible). No application code reads these hashes, so this is lossless.
UPDATE public.verification_requests SET ic_number_hash = NULL WHERE ic_number_hash IS NOT NULL;
UPDATE public.profiles SET identity_number_hash = NULL WHERE identity_number_hash IS NOT NULL;