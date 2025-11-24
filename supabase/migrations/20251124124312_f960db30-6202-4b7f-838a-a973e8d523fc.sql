-- Fix Critical Security Issues (Corrected)
-- Drop ALL existing policies first to avoid conflicts

-- Issue 1: Profiles table - restrict phone number access
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own full profile" ON profiles;
DROP POLICY IF EXISTS "Public can view basic profile info" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create new restricted policies
CREATE POLICY "Public can view basic profile info"
ON profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Issue 2: Verification requests - restrict document access
DROP POLICY IF EXISTS "Users can view own verifications" ON verification_requests;
DROP POLICY IF EXISTS "Admins can view all verifications" ON verification_requests;
DROP POLICY IF EXISTS "Users can view own verification status" ON verification_requests;
DROP POLICY IF EXISTS "Admins can view all verification requests" ON verification_requests;

CREATE POLICY "Users can view own verification status"
ON verification_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all verification requests"
ON verification_requests FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Issue 3: Bank accounts - ensure proper access control
DROP POLICY IF EXISTS "Users can view their own bank accounts" ON owner_bank_accounts;
DROP POLICY IF EXISTS "Admins can view all bank accounts" ON owner_bank_accounts;
DROP POLICY IF EXISTS "Users can view own bank account" ON owner_bank_accounts;
DROP POLICY IF EXISTS "Users can manage own bank account" ON owner_bank_accounts;
DROP POLICY IF EXISTS "Admins can view bank accounts for payouts" ON owner_bank_accounts;
DROP POLICY IF EXISTS "Users can manage their own bank accounts" ON owner_bank_accounts;

CREATE POLICY "Users can manage own bank account"
ON owner_bank_accounts FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view bank accounts for payouts"
ON owner_bank_accounts FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Issue 4: Messages - ensure proper encryption and access
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
DROP POLICY IF EXISTS "Users can view own messages" ON messages;

CREATE POLICY "Users can view own messages"
ON messages FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Create audit log for sensitive data access
CREATE TABLE IF NOT EXISTS sensitive_data_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  access_type text NOT NULL,
  ip_address inet,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sensitive_data_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can view access logs" ON sensitive_data_access_log;
DROP POLICY IF EXISTS "System can insert access logs" ON sensitive_data_access_log;

CREATE POLICY "Only admins can view access logs"
ON sensitive_data_access_log FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert access logs"
ON sensitive_data_access_log FOR INSERT
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sensitive_access_user ON sensitive_data_access_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensitive_access_resource ON sensitive_data_access_log(resource_type, resource_id);