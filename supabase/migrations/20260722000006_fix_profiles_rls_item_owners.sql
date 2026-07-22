-- Allow viewing profiles of item owners with active listings
-- Fixes ItemDetail.tsx owner profile returning NULL for non-rental-participants

CREATE POLICY "Anyone can view profiles of active item owners"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.items
    WHERE items.owner_id = profiles.id
      AND items.listing_status = 'active'
  )
  AND (profiles.is_deleted IS NOT TRUE OR profiles.is_deleted IS NULL)
);
