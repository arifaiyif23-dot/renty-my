-- Allow unverified users to create draft items
-- The old policy blocked ALL inserts for unverified users, preventing draft creation.
-- Now, any authenticated user can create items (frontend blocks active listing for unverified).
-- Also fixes the items INSERT RLS error handling mismatch.

-- Items: replace strict verified-only policy with owner-only check
DROP POLICY IF EXISTS "Verified users can create items" ON public.items;
DROP POLICY IF EXISTS "Users can create items" ON public.items;

CREATE POLICY "Users can create items"
ON public.items
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = owner_id
);

-- Rentals: keep verified-only policy (defense-in-depth for booking)
-- No change needed — the request-booking edge function uses service_role key.
