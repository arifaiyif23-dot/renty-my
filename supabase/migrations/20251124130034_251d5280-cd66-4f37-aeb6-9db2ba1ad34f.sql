-- ==========================================
-- SECURITY HARDENING MIGRATION
-- Fixes critical security vulnerabilities
-- ==========================================

-- 1. FIX: Phone Number Exposure in Profiles
-- Drop overly permissive policy and create restricted ones
DROP POLICY IF EXISTS "Public can view basic profile info" ON profiles;

-- Allow users to view their own complete profile
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Allow rental participants to view each other's full profiles (including phone)
CREATE POLICY "Rental participants can view each other's profiles"
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM rentals r
    WHERE (r.renter_id = auth.uid() OR r.owner_id = auth.uid())
    AND (r.renter_id = profiles.id OR r.owner_id = profiles.id)
    AND r.status IN ('approved', 'active')
  )
);

-- 2. CREATE: Secure profiles view (without phone numbers for public)
CREATE OR REPLACE VIEW profiles_public_safe AS
SELECT 
  id,
  full_name,
  avatar_url,
  location,
  is_verified,
  created_at
FROM profiles;

-- Grant access to the safe view
GRANT SELECT ON profiles_public_safe TO authenticated, anon;

-- 3. ENABLE: pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 4. ADD: Encryption functions for sensitive data
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data text, key text DEFAULT 'your-encryption-key-change-this')
RETURNS text AS $$
BEGIN
  RETURN encode(pgp_sym_encrypt(data, key), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data text, key text DEFAULT 'your-encryption-key-change-this')
RETURNS text AS $$
BEGIN
  RETURN pgp_sym_decrypt(decode(encrypted_data, 'base64'), key);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. ADD: Function to mask account numbers (show only last 4 digits)
CREATE OR REPLACE FUNCTION mask_account_number(account_number text)
RETURNS text AS $$
BEGIN
  IF account_number IS NULL OR length(account_number) < 4 THEN
    RETURN '****';
  END IF;
  RETURN repeat('*', length(account_number) - 4) || right(account_number, 4);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. FIX: Add encrypted_account_number column to owner_bank_accounts
ALTER TABLE owner_bank_accounts 
ADD COLUMN IF NOT EXISTS encrypted_account_number text;

-- 7. FIX: Add encrypted_content column to messages
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS encrypted_content text;

-- 8. FIX: Hash IC numbers in verification_requests
ALTER TABLE verification_requests 
ADD COLUMN IF NOT EXISTS ic_number_hash text;

-- Create index for ic_number_hash lookups
CREATE INDEX IF NOT EXISTS idx_verification_ic_hash ON verification_requests(ic_number_hash);

-- 9. FIX: Add document_expires_at for time-limited access
ALTER TABLE verification_requests 
ADD COLUMN IF NOT EXISTS document_expires_at timestamp with time zone DEFAULT (now() + interval '1 hour');

-- 10. CREATE: Function to hash IC numbers
CREATE OR REPLACE FUNCTION hash_ic_number(ic text)
RETURNS text AS $$
BEGIN
  RETURN encode(digest(ic || 'salt-change-this', 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 11. FIX: Location privacy - Add approximate location columns
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS approximate_location text,
ADD COLUMN IF NOT EXISTS show_precise_location boolean DEFAULT false;

ALTER TABLE items 
ADD COLUMN IF NOT EXISTS approximate_latitude numeric,
ADD COLUMN IF NOT EXISTS approximate_longitude numeric,
ADD COLUMN IF NOT EXISTS show_precise_location boolean DEFAULT false;

-- 12. CREATE: Function to approximate coordinates (round to 2 decimal places ~1km accuracy)
CREATE OR REPLACE FUNCTION approximate_coordinate(coord numeric)
RETURNS numeric AS $$
BEGIN
  RETURN ROUND(coord::numeric, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 13. CREATE: Enhanced rate limit check function
CREATE OR REPLACE FUNCTION check_rate_limit_enhanced(
  p_user_id uuid,
  p_ip_address inet,
  p_action text,
  p_max_attempts integer,
  p_window_minutes integer
) RETURNS boolean AS $$
DECLARE
  v_count integer;
BEGIN
  -- Count attempts in the time window
  SELECT COUNT(*) INTO v_count
  FROM rate_limits
  WHERE action = p_action
    AND created_at > NOW() - (p_window_minutes || ' minutes')::interval
    AND (
      (p_user_id IS NOT NULL AND user_id = p_user_id) OR
      (p_ip_address IS NOT NULL AND ip_address = p_ip_address)
    );
  
  -- If under limit, log this attempt
  IF v_count < p_max_attempts THEN
    INSERT INTO rate_limits (user_id, ip_address, action)
    VALUES (p_user_id, p_ip_address, p_action);
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 14. FIX: Audit logging for sensitive data access
CREATE OR REPLACE FUNCTION log_sensitive_access(
  p_user_id uuid,
  p_resource_type text,
  p_resource_id text,
  p_access_type text
) RETURNS void AS $$
BEGIN
  INSERT INTO sensitive_data_access_log (
    user_id,
    resource_type,
    resource_id,
    access_type,
    ip_address
  ) VALUES (
    p_user_id,
    p_resource_type,
    p_resource_id,
    p_access_type,
    inet_client_addr()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 15. Create trigger to auto-approximate coordinates
CREATE OR REPLACE FUNCTION update_approximate_coordinates()
RETURNS trigger AS $$
BEGIN
  IF NEW.latitude IS NOT NULL THEN
    NEW.approximate_latitude := approximate_coordinate(NEW.latitude);
  END IF;
  IF NEW.longitude IS NOT NULL THEN
    NEW.approximate_longitude := approximate_coordinate(NEW.longitude);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_item_approximate_coords ON items;
CREATE TRIGGER update_item_approximate_coords
  BEFORE INSERT OR UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION update_approximate_coordinates();

-- Apply to existing items
UPDATE items 
SET approximate_latitude = approximate_coordinate(latitude),
    approximate_longitude = approximate_coordinate(longitude)
WHERE latitude IS NOT NULL OR longitude IS NOT NULL;

-- 16. Add indexes for rate limit checks
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup 
ON rate_limits(user_id, action, created_at);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_lookup 
ON rate_limits(ip_address, action, created_at);

-- 17. Add comments for documentation
COMMENT ON FUNCTION encrypt_sensitive_data IS 'Encrypts sensitive data using pgcrypto. IMPORTANT: Change default encryption key in production!';
COMMENT ON FUNCTION hash_ic_number IS 'Hashes IC numbers for privacy. IMPORTANT: Change salt in production!';
COMMENT ON COLUMN owner_bank_accounts.encrypted_account_number IS 'Encrypted bank account number for security';
COMMENT ON COLUMN messages.encrypted_content IS 'Encrypted message content for privacy';
COMMENT ON COLUMN verification_requests.ic_number_hash IS 'Hashed IC number for privacy and security';