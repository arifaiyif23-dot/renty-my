-- Fix calculate_verification_confidence function to set search_path
-- This addresses the Supabase linter warning about mutable search_path

CREATE OR REPLACE FUNCTION public.calculate_verification_confidence(doc_quality integer, face_match integer, liveness integer)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path = public
AS $function$
BEGIN
  RETURN ROUND(
    (doc_quality * 0.3) + 
    (face_match * 0.5) + 
    (liveness * 0.2)
  );
END;
$function$;