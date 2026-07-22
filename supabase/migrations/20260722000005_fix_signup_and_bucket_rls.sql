-- H1: Fix signup race condition for preferred_role
-- Pass preferred_role via user_metadata during signUp so the trigger sets it immediately.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, preferred_role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'preferred_role', 'renter')
  );
  RETURN NEW;
END;
$function$;

-- H9: Restrict item-images INSERT to user's own folder
-- Previously any authenticated user could upload to any folder.
DROP POLICY IF EXISTS "Authenticated users can upload item images" ON storage.objects;

CREATE POLICY "Users can upload item images to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'item-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
