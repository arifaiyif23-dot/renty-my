
-- Add T&C consent + founding vendor fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS founding_vendor boolean NOT NULL DEFAULT false;

-- Add payment_mode to items and rentals (escrow default, manual as second option)
DO $$ BEGIN
  CREATE TYPE public.payment_mode AS ENUM ('escrow', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS payment_mode public.payment_mode NOT NULL DEFAULT 'escrow';

ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS payment_mode public.payment_mode NOT NULL DEFAULT 'escrow',
  ADD COLUMN IF NOT EXISTS manual_payment_proof_url text,
  ADD COLUMN IF NOT EXISTS manual_payment_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_payment_confirmed_by uuid;

-- Data subject requests (PDPA)
CREATE TABLE IF NOT EXISTS public.data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('export', 'deletion', 'correction')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
  notes text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.data_requests TO authenticated;
GRANT ALL ON public.data_requests TO service_role;

ALTER TABLE public.data_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data requests"
  ON public.data_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own data requests"
  ON public.data_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all data requests"
  ON public.data_requests FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER data_requests_updated_at
  BEFORE UPDATE ON public.data_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
