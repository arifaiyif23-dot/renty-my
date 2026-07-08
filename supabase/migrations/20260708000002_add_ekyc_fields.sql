-- Add eKYC / trust fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS verification_level VARCHAR(20) DEFAULT 'unverified'
    CHECK (verification_level IN ('unverified', 'email', 'basic', 'kyc', 'premium')),
  ADD COLUMN IF NOT EXISTS identity_number TEXT,
  ADD COLUMN IF NOT EXISTS identity_number_hash TEXT,
  ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ekyc_provider VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ekyc_session_id TEXT,
  ADD COLUMN IF NOT EXISTS ekyc_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_rentals_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_reviews_received INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS response_rate DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Add eKYC fields to verification_requests
ALTER TABLE verification_requests
  ADD COLUMN IF NOT EXISTS ekyc_provider VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ekyc_session_id TEXT,
  ADD COLUMN IF NOT EXISTS ekyc_result JSONB,
  ADD COLUMN IF NOT EXISTS identity_number TEXT,
  ADD COLUMN IF NOT EXISTS identity_number_validated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_level VARCHAR(20) DEFAULT 'basic'
    CHECK (verification_level IN ('basic', 'kyc', 'premium'));

-- Update existing rows
UPDATE profiles SET verification_level = 'kyc' WHERE is_verified = true AND verification_level = 'unverified';
UPDATE profiles SET verification_level = 'basic' WHERE is_verified = false AND verification_level = 'unverified';

-- Index for trust score queries
CREATE INDEX IF NOT EXISTS idx_profiles_verification_level ON profiles(verification_level);
CREATE INDEX IF NOT EXISTS idx_profiles_trust_score ON profiles(trust_score DESC);
