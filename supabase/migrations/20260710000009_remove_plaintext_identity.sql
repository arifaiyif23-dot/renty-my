-- Drop plaintext identity columns (keep hashes only)
-- The backfill was done inline when columns were first added.

-- Drop old trigger on verification_requests that references ic_number
DROP TRIGGER IF EXISTS hash_ic_trigger ON verification_requests;
DROP FUNCTION IF EXISTS public.hash_ic_on_insert();

-- Drop plaintext columns (IF EXISTS so it's safe if already dropped)
ALTER TABLE profiles DROP COLUMN IF EXISTS identity_number;
ALTER TABLE verification_requests DROP COLUMN IF EXISTS ic_number;
ALTER TABLE verification_requests DROP COLUMN IF EXISTS identity_number;
