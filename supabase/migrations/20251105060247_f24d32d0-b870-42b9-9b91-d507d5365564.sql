-- Add OpenAI metadata to verification_requests
ALTER TABLE verification_requests 
ADD COLUMN openai_model VARCHAR(50),
ADD COLUMN ai_processing_time_ms INTEGER,
ADD COLUMN fraud_risk_score INTEGER CHECK (fraud_risk_score >= 0 AND fraud_risk_score <= 100),
ADD COLUMN video_liveness_url TEXT,
ADD COLUMN liveness_video_frames TEXT[],
ADD COLUMN document_back_analyzed BOOLEAN DEFAULT false,
ADD COLUMN additional_documents JSONB;

-- Add AI analysis to items
ALTER TABLE items 
ADD COLUMN ai_brand_detected VARCHAR(100),
ADD COLUMN ai_damage_assessment JSONB,
ADD COLUMN ai_authenticity_score INTEGER CHECK (ai_authenticity_score >= 0 AND ai_authenticity_score <= 100),
ADD COLUMN ai_market_price_estimate NUMERIC,
ADD COLUMN ai_category_suggested TEXT,
ADD COLUMN ai_seo_keywords TEXT[];

-- Chat sessions for AI support
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  messages JSONB[] NOT NULL DEFAULT '{}',
  sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'neutral', 'negative', 'frustrated')),
  resolved BOOLEAN DEFAULT false,
  escalated_to_human BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fraud detection logs
CREATE TABLE fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  details JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_sessions
CREATE POLICY "Users can view own chat sessions"
ON chat_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own chat sessions"
ON chat_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions"
ON chat_sessions FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policies for fraud_alerts
CREATE POLICY "Admins can view all fraud alerts"
ON fraud_alerts FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage fraud alerts"
ON fraud_alerts FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can create fraud alerts"
ON fraud_alerts FOR INSERT
WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_chat_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chat_sessions_updated_at
BEFORE UPDATE ON chat_sessions
FOR EACH ROW
EXECUTE FUNCTION update_chat_sessions_updated_at();