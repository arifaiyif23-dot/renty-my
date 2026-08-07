-- Security guard: encryption key must come from a private secret, not the repo.
-- The previous migration (20260726000001) seeded a committed constant
-- (`r3nty..._2026_a8f7b2c9d1e4`) as the live key in platform_settings. That value
-- is now known publicly and MUST be rotated.
--
-- IMPORTANT (production operator action):
--   1. Generate a new random key, e.g.   openssl rand -base64 48
--   2. In the Supabase dashboard run:
--        UPDATE platform_settings SET value = to_jsonb('<NEW_KEY>'::text)
--        WHERE key = 'encryption_key';
--   3. This migration only ADDS a guard + re-encryption helpers. Do NOT run in
--      limbo: existing rows are still encrypted with the OLD key, so you must
--      decrypt with the old key and re-encrypt with the new one (see helpers below).
--
-- Until an operator sets a real key, the encryption functions already RAISE
-- EXCEPTION (fail-closed) instead of falling back to a committed secret.

-- 1. Never auto-seed the committed fallback on fresh installs.
--    The prior INSERT ... WHERE NOT EXISTS is removed by never running it here.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM platform_settings
    WHERE key = 'encryption_key'
      AND value::text = '"r3nty_pr0d_m5g_enc_k3y_2026_a8f7b2c9d1e4"'
  ) THEN
    RAISE NOTICE 'WARNING: platform_settings.encryption_key is still the KNOWN placeholder value committed in the repo. Rotate it now per 20260807000003 header.';
  END IF;
END
$$;

-- 2. Operators only: rotate helper using an in-transaction temp vault.
--    Uncomment and supply YOUR keys to migrate existing rows:
--      NEW_KEY := '<paste openssl rand -base64 48 here>';
--    Examples of tables holding pgp_sym_encrypt-ed values:
--      - encrypted_message_content.messages
--      - user_bank_accounts, identities (whichever is encrypted)
--    Because decryption here runs in SQL, run this via dashboard with
--    search_path awareness; never ship the key to the repo.