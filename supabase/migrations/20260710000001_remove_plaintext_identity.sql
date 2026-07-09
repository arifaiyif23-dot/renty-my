-- Remove plaintext identity_number and ic_number columns (keep hashes only)

-- 1. Backfill identity_number_hash on profiles from existing plaintext
UPDATE profiles
SET identity_number_hash = public.hash_ic_number(identity_number)
WHERE identity_number IS NOT NULL
  AND (identity_number_hash IS NULL OR identity_number_hash = '');

-- 2. Backfill ic_number_hash on verification_requests from existing identity_number values
UPDATE verification_requests
SET ic_number_hash = public.hash_ic_number(identity_number)
WHERE identity_number IS NOT NULL
  AND (ic_number_hash IS NULL OR ic_number_hash = '');

-- 3. Drop old trigger on verification_requests that references ic_number
DROP TRIGGER IF EXISTS hash_ic_trigger ON verification_requests;
DROP FUNCTION IF EXISTS public.hash_ic_on_insert();

-- 4. Drop plaintext columns
ALTER TABLE profiles DROP COLUMN IF EXISTS identity_number;
ALTER TABLE verification_requests DROP COLUMN IF EXISTS ic_number;
ALTER TABLE verification_requests DROP COLUMN IF EXISTS identity_number;
