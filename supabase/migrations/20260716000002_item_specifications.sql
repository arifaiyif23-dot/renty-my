ALTER TABLE items
  ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}';

-- Migrate instant_book_enabled / auto_approve_bookings to public.items if not exist
-- (already added in 20251023052425 migration, just ensure they're present)
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS instant_book_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_approve_bookings BOOLEAN DEFAULT false;
