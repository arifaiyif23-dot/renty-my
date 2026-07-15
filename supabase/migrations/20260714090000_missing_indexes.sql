-- Migration: Add missing database indexes for production performance
-- Date: 2026-07-14

-- Items indexes (critical for homepage, search, and MyListings)
CREATE INDEX IF NOT EXISTS idx_items_is_available_created_at
  ON public.items (is_available, created_at DESC)
  WHERE is_available = true;

CREATE INDEX IF NOT EXISTS idx_items_owner_listing_status_created_at
  ON public.items (owner_id, listing_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_items_category_is_available
  ON public.items (category, is_available)
  WHERE is_available = true;

-- Rentals indexes (critical for Dashboard, Search, ItemDetail)
CREATE INDEX IF NOT EXISTS idx_rentals_renter_owner
  ON public.rentals (renter_id, owner_id);

CREATE INDEX IF NOT EXISTS idx_rentals_item_id_status
  ON public.rentals (item_id, status);

-- Messages indexes (critical for Header unread count and conversation threads)
CREATE INDEX IF NOT EXISTS idx_messages_recipient_is_read
  ON public.messages (recipient_id, is_read)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_messages_sender_recipient_created_at
  ON public.messages (sender_id, recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_created_at_desc
  ON public.messages (created_at DESC);

-- Notifications indexes (for NotificationBell)
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_is_read
  ON public.notifications (user_id, is_read);

-- Payouts indexes (for Earnings page)
CREATE INDEX IF NOT EXISTS idx_payouts_owner_created_at
  ON public.payouts (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payouts_status_created_at
  ON public.payouts (status, created_at DESC);

-- Payments index for PayNowButton
CREATE INDEX IF NOT EXISTS idx_payments_rental_status_created_at
  ON public.payments (rental_id, status, created_at DESC);

-- Reviews index for ReviewsList
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_created_at
  ON public.reviews (reviewee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id
  ON public.reviews (reviewer_id);

-- Item views index for SocialProof
CREATE INDEX IF NOT EXISTS idx_item_views_item_viewed_at
  ON public.item_views (item_id, viewed_at);
