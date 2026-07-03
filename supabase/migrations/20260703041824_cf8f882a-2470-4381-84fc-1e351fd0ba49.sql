-- Add fashion to item_category enum
ALTER TYPE public.item_category ADD VALUE IF NOT EXISTS 'fashion';

-- Add hourly pricing and deposit to items
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS price_per_hour numeric,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric DEFAULT 0;

-- Vendor onboarding tracking on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_role text DEFAULT 'renter' CHECK (preferred_role IN ('renter','vendor')),
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Vendor blocked dates table (owner marks unavailability outside of bookings)
CREATE TABLE IF NOT EXISTS public.item_blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.item_blocked_dates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_blocked_dates TO authenticated;
GRANT ALL ON public.item_blocked_dates TO service_role;

ALTER TABLE public.item_blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view blocked dates"
  ON public.item_blocked_dates FOR SELECT
  USING (true);

CREATE POLICY "Owners manage own blocked dates"
  ON public.item_blocked_dates FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_item_blocked_dates_item ON public.item_blocked_dates(item_id);
CREATE INDEX IF NOT EXISTS idx_item_blocked_dates_range ON public.item_blocked_dates(item_id, start_date, end_date);