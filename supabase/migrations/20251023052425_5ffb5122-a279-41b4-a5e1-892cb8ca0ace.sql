-- Add advanced columns to items table
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS booking_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_approve_bookings BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS minimum_rental_days INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS maximum_rental_days INTEGER,
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS instant_book_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS listing_status TEXT DEFAULT 'active' CHECK (listing_status IN ('active', 'paused', 'draft', 'archived')),
  ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cancellation_policy TEXT DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS item_condition TEXT DEFAULT 'good' CHECK (item_condition IN ('new', 'like_new', 'good', 'fair'));

-- Create listing_analytics table
CREATE TABLE IF NOT EXISTS listing_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  views INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  booking_requests INTEGER DEFAULT 0,
  bookings_confirmed INTEGER DEFAULT 0,
  revenue NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(item_id, date)
);

-- Enable RLS on listing_analytics
ALTER TABLE listing_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their listing analytics"
ON listing_analytics FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM items 
    WHERE items.id = listing_analytics.item_id 
    AND items.owner_id = auth.uid()
  )
);

CREATE POLICY "System can insert analytics"
ON listing_analytics FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update analytics"
ON listing_analytics FOR UPDATE
USING (true);

-- Create listing_edit_history table
CREATE TABLE IF NOT EXISTS listing_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  edited_by UUID REFERENCES profiles(id) NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  edit_type TEXT CHECK (edit_type IN ('create', 'update', 'delete', 'status_change')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on listing_edit_history
ALTER TABLE listing_edit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their listing history"
ON listing_edit_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM items 
    WHERE items.id = listing_edit_history.item_id 
    AND items.owner_id = auth.uid()
  )
);

CREATE POLICY "System can insert edit history"
ON listing_edit_history FOR INSERT
WITH CHECK (true);

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_item_views(item_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE items 
  SET view_count = view_count + 1 
  WHERE id = item_id_param;
  
  -- Also update daily analytics
  INSERT INTO listing_analytics (item_id, date, views)
  VALUES (item_id_param, CURRENT_DATE, 1)
  ON CONFLICT (item_id, date) 
  DO UPDATE SET views = listing_analytics.views + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to calculate conversion rate
CREATE OR REPLACE FUNCTION get_listing_conversion_rate(item_id_param UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_views INTEGER;
  total_bookings INTEGER;
BEGIN
  SELECT COALESCE(SUM(views), 0) INTO total_views
  FROM listing_analytics
  WHERE item_id = item_id_param;
  
  SELECT COALESCE(SUM(bookings_confirmed), 0) INTO total_bookings
  FROM listing_analytics
  WHERE item_id = item_id_param;
  
  IF total_views = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN (total_bookings::NUMERIC / total_views::NUMERIC) * 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to track edits
CREATE OR REPLACE FUNCTION track_listing_edit()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO listing_edit_history (item_id, edited_by, field_name, old_value, new_value, edit_type)
  VALUES (
    NEW.id,
    auth.uid(),
    'listing_updated',
    NULL,
    NULL,
    'update'
  );
  
  NEW.last_edited_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for tracking edits
DROP TRIGGER IF EXISTS track_item_edits ON items;
CREATE TRIGGER track_item_edits
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION track_listing_edit();