-- Phase 2: Essential Features Database Setup

-- Create rental_modifications table for extensions and early returns
CREATE TABLE public.rental_modifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('extension', 'early_return')),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  original_end_date DATE NOT NULL,
  new_end_date DATE NOT NULL,
  price_adjustment NUMERIC NOT NULL,
  reason TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  responded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on rental_modifications
ALTER TABLE public.rental_modifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rental_modifications
CREATE POLICY "Users can view their rental modifications"
ON public.rental_modifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rentals
    WHERE rentals.id = rental_modifications.rental_id
    AND (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
  )
);

CREATE POLICY "Renters can request modifications"
ON public.rental_modifications
FOR INSERT
WITH CHECK (
  auth.uid() = requested_by
  AND EXISTS (
    SELECT 1 FROM public.rentals
    WHERE rentals.id = rental_modifications.rental_id
    AND rentals.renter_id = auth.uid()
  )
);

CREATE POLICY "Owners can respond to modifications"
ON public.rental_modifications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.rentals
    WHERE rentals.id = rental_modifications.rental_id
    AND rentals.owner_id = auth.uid()
  )
);

-- Add message enhancements columns
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_type TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- Create saved_searches table
CREATE TABLE public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  category TEXT,
  min_price NUMERIC,
  max_price NUMERIC,
  verified_only BOOLEAN DEFAULT false,
  instant_book_only BOOLEAN DEFAULT false,
  notify_on_new BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on saved_searches
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for saved_searches
CREATE POLICY "Users can manage their saved searches"
ON public.saved_searches
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create user_views table for recently viewed items
CREATE TABLE public.user_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_views
ALTER TABLE public.user_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_views
CREATE POLICY "Users can manage their own views"
ON public.user_views
FOR ALL
USING (auth.uid() = user_id OR user_id IS NULL)
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Create index for better performance on user_views
CREATE INDEX idx_user_views_user_item ON public.user_views(user_id, item_id);
CREATE INDEX idx_user_views_viewed_at ON public.user_views(viewed_at DESC);

-- Update trigger for rental_modifications
CREATE TRIGGER update_rental_modifications_updated_at
BEFORE UPDATE ON public.rental_modifications
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Update trigger for saved_searches
CREATE TRIGGER update_saved_searches_updated_at
BEFORE UPDATE ON public.saved_searches
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();