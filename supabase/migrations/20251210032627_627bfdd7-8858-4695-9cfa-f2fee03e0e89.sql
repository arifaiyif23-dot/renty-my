-- Fix the encrypt_sensitive_data function to use extensions.pgcrypto
CREATE OR REPLACE FUNCTION public.encrypt_sensitive_data(data text, key text DEFAULT 'your-encryption-key-change-this'::text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN encode(extensions.pgp_sym_encrypt(data, key), 'base64');
END;
$$;

-- Fix the decrypt_sensitive_data function to use extensions.pgcrypto
CREATE OR REPLACE FUNCTION public.decrypt_sensitive_data(encrypted_data text, key text DEFAULT 'your-encryption-key-change-this'::text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN extensions.pgp_sym_decrypt(decode(encrypted_data, 'base64'), key);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Step 1: Update existing bank accounts to use encrypted storage
UPDATE owner_bank_accounts 
SET encrypted_account_number = public.encrypt_sensitive_data(account_number)
WHERE account_number IS NOT NULL 
  AND (encrypted_account_number IS NULL OR encrypted_account_number = '');

-- Step 2: Hash existing IC numbers in verification_requests
UPDATE verification_requests
SET ic_number_hash = public.hash_ic_number(ic_number)
WHERE ic_number IS NOT NULL 
  AND (ic_number_hash IS NULL OR ic_number_hash = '');

-- Step 3: Clear plaintext IC numbers after hashing (keep only hash)
UPDATE verification_requests
SET ic_number = NULL
WHERE ic_number IS NOT NULL 
  AND ic_number_hash IS NOT NULL;

-- Step 4: Create a trigger to automatically encrypt new bank account numbers
CREATE OR REPLACE FUNCTION public.encrypt_bank_account_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_number IS NOT NULL THEN
    NEW.encrypted_account_number := public.encrypt_sensitive_data(NEW.account_number);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS encrypt_bank_account_trigger ON owner_bank_accounts;

CREATE TRIGGER encrypt_bank_account_trigger
  BEFORE INSERT OR UPDATE ON owner_bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_bank_account_on_insert();

-- Step 5: Create a trigger to automatically hash IC numbers
CREATE OR REPLACE FUNCTION public.hash_ic_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ic_number IS NOT NULL THEN
    NEW.ic_number_hash := public.hash_ic_number(NEW.ic_number);
    NEW.ic_number := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS hash_ic_trigger ON verification_requests;

CREATE TRIGGER hash_ic_trigger
  BEFORE INSERT OR UPDATE ON verification_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.hash_ic_on_insert();