CREATE TABLE IF NOT EXISTS public.condition_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('pre_rental', 'post_rental')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'acknowledged')),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  overall_condition TEXT CHECK (overall_condition IN ('excellent', 'good', 'fair', 'poor')),
  overall_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  UNIQUE(rental_id, report_type, created_by)
);

CREATE TABLE IF NOT EXISTS public.condition_report_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.condition_reports(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('excellent', 'good', 'fair', 'poor', 'damaged', 'missing')),
  notes TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.condition_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.condition_reports(id) ON DELETE CASCADE,
  signed_by UUID NOT NULL REFERENCES public.profiles(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'renter')),
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(report_id, signed_by)
);

CREATE INDEX IF NOT EXISTS idx_condition_reports_rental ON public.condition_reports(rental_id);
CREATE INDEX IF NOT EXISTS idx_condition_report_items_report ON public.condition_report_items(report_id);
CREATE INDEX IF NOT EXISTS idx_condition_signatures_report ON public.condition_signatures(report_id);

ALTER TABLE public.condition_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condition_report_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condition_signatures ENABLE ROW LEVEL SECURITY;

-- Condition reports: owners and renters of the rental can read
CREATE POLICY "condition_reports_select" ON public.condition_reports
  FOR SELECT USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.rentals r
      WHERE r.id = rental_id AND (r.owner_id = auth.uid() OR r.renter_id = auth.uid())
    )
  );

CREATE POLICY "condition_reports_insert" ON public.condition_reports
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "condition_reports_update" ON public.condition_reports
  FOR UPDATE USING (created_by = auth.uid());

-- Report items: same as parent report
CREATE POLICY "condition_report_items_select" ON public.condition_report_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.condition_reports cr
      JOIN public.rentals r ON r.id = cr.rental_id
      WHERE cr.id = report_id AND (r.owner_id = auth.uid() OR r.renter_id = auth.uid())
    )
  );

CREATE POLICY "condition_report_items_insert" ON public.condition_report_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.condition_reports cr
      WHERE cr.id = report_id AND cr.created_by = auth.uid()
    )
  );

CREATE POLICY "condition_report_items_update" ON public.condition_report_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.condition_reports cr
      WHERE cr.id = report_id AND cr.created_by = auth.uid()
    )
  );

-- Signatures: owners and renters can see, only relevant party can insert
CREATE POLICY "condition_signatures_select" ON public.condition_signatures
  FOR SELECT USING (
    signed_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.condition_reports cr
      JOIN public.rentals r ON r.id = cr.rental_id
      WHERE cr.id = report_id AND (r.owner_id = auth.uid() OR r.renter_id = auth.uid())
    )
  );

CREATE POLICY "condition_signatures_insert" ON public.condition_signatures
  FOR INSERT WITH CHECK (signed_by = auth.uid());
