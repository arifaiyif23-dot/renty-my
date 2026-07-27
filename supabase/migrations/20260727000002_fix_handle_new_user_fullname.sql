-- Fix handle_new_user: add COALESCE fallback for full_name
-- Without this, signup fails with 500 when full_name is null/missing.
-- This can happen if the auth.signUp() call doesn't include full_name in user_metadata,
-- or during edge-case race conditions with the trigger.

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
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'preferred_role', 'renter')
  );
  RETURN NEW;
END;
$function$;
