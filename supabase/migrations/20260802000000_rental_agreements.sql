-- Per-rental digital agreement.
-- Accepted by the renter at booking request time, and by the owner at approval time.
-- The `content` jsonb holds a tamper-resistant snapshot of the deal (item, parties,
-- dates, prices) built server-side by the edge functions; the clause text is rendered
-- from i18n at view time so it always matches the viewer's language.

CREATE TABLE IF NOT EXISTS public.rental_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL UNIQUE REFERENCES public.rentals(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL DEFAULT '1',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  renter_accepted_at TIMESTAMPTZ,
  renter_full_name TEXT,
  owner_accepted_at TIMESTAMPTZ,
  owner_full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.rental_agreements ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rental_agreements_rental_id ON public.rental_agreements(rental_id);

-- Only the renter, the owner, or admins can view an agreement.
-- Writes happen exclusively through the edge functions (service_role bypasses RLS).
CREATE POLICY "Renter or owner can view rental agreement"
  ON public.rental_agreements FOR SELECT
  USING (
    auth.uid() = (SELECT renter_id FROM public.rentals WHERE id = rental_id)
    OR auth.uid() = (SELECT owner_id FROM public.rentals WHERE id = rental_id)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER rental_agreements_updated_at
  BEFORE UPDATE ON public.rental_agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
