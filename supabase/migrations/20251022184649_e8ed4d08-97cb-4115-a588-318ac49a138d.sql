-- Create saved_items (wishlist) table
CREATE TABLE public.saved_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, item_id)
);

-- Enable RLS
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for saved_items
CREATE POLICY "Users can view their saved items"
  ON public.saved_items
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save items"
  ON public.saved_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave items"
  ON public.saved_items
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create item_views table for social proof
CREATE TABLE public.item_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  user_id UUID,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.item_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies for item_views
CREATE POLICY "Anyone can view item views"
  ON public.item_views
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can track views"
  ON public.item_views
  FOR INSERT
  WITH CHECK (true);

-- Add index for better performance
CREATE INDEX idx_saved_items_user_id ON public.saved_items(user_id);
CREATE INDEX idx_saved_items_item_id ON public.saved_items(item_id);
CREATE INDEX idx_item_views_item_id ON public.item_views(item_id);
CREATE INDEX idx_item_views_viewed_at ON public.item_views(viewed_at);