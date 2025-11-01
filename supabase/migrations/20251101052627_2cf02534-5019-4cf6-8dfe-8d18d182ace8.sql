-- Create review_images table for photo uploads
CREATE TABLE IF NOT EXISTS public.review_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on review_images
ALTER TABLE public.review_images ENABLE ROW LEVEL SECURITY;

-- Review images are viewable by everyone
CREATE POLICY "Review images are viewable by everyone"
ON public.review_images
FOR SELECT
USING (true);

-- Users can add images to their own reviews
CREATE POLICY "Users can add images to their reviews"
ON public.review_images
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.reviews
    WHERE reviews.id = review_images.review_id
    AND reviews.reviewer_id = auth.uid()
  )
);

-- Add helpful votes columns to reviews
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS helpful_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS owner_response TEXT,
ADD COLUMN IF NOT EXISTS owner_response_at TIMESTAMP WITH TIME ZONE;

-- Create review_votes table for tracking helpful votes
CREATE TABLE IF NOT EXISTS public.review_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(review_id, user_id)
);

-- Enable RLS on review_votes
ALTER TABLE public.review_votes ENABLE ROW LEVEL SECURITY;

-- Users can view all votes
CREATE POLICY "Users can view review votes"
ON public.review_votes
FOR SELECT
USING (true);

-- Users can vote on reviews
CREATE POLICY "Users can vote on reviews"
ON public.review_votes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own votes
CREATE POLICY "Users can update own votes"
ON public.review_votes
FOR UPDATE
USING (auth.uid() = user_id);

-- Create listing_analytics_daily view for aggregated analytics
CREATE OR REPLACE VIEW public.listing_analytics_summary AS
SELECT 
  item_id,
  SUM(views) as total_views,
  SUM(clicks) as total_clicks,
  SUM(bookings_confirmed) as total_bookings,
  SUM(booking_requests) as total_requests,
  SUM(revenue) as total_revenue,
  CASE 
    WHEN SUM(views) > 0 THEN (SUM(bookings_confirmed)::NUMERIC / SUM(views)::NUMERIC) * 100
    ELSE 0
  END as conversion_rate
FROM public.listing_analytics
GROUP BY item_id;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_review_images_review_id ON public.review_images(review_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_review_id ON public.review_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_user_id ON public.review_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_listing_analytics_item_date ON public.listing_analytics(item_id, date DESC);