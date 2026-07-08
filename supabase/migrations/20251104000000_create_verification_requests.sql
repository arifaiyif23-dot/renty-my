-- Create verification_requests table (missing from original migrations)
CREATE TABLE IF NOT EXISTS verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  document_front_url TEXT NOT NULL,
  document_back_url TEXT,
  selfie_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'approved', 'rejected')),
  full_name_on_document VARCHAR(200),
  ic_number TEXT,
  date_of_birth DATE,
  document_quality_score INTEGER,
  face_match_score INTEGER,
  liveness_score INTEGER,
  overall_confidence_score INTEGER,
  fraud_risk_score INTEGER,
  ai_analysis_result JSONB,
  ai_processing_time_ms INTEGER,
  openai_model VARCHAR(50),
  video_liveness_url TEXT,
  liveness_video_frames TEXT[],
  document_back_analyzed BOOLEAN DEFAULT false,
  additional_documents JSONB,
  ic_number_hash TEXT,
  verification_method VARCHAR(50),
  notes TEXT,
  verified_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;
