CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query_text TEXT,
  category VARCHAR(50),
  location TEXT,
  min_price DECIMAL(10,2),
  max_price DECIMAL(10,2),
  sort_by VARCHAR(20) DEFAULT 'created_at',
  label VARCHAR(100),
  notify_on_new BOOLEAN DEFAULT false,
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own saved searches" ON saved_searches
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
