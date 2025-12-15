-- Fix notify_rental_changes to use proper HTTP call with service role key
CREATE OR REPLACE FUNCTION public.notify_rental_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  payload jsonb;
  edge_function_url text;
  service_role_key text;
BEGIN
  -- Get service role key from vault or env
  service_role_key := current_setting('app.settings.supabase_service_role_key', true);
  
  -- Construct the URL for the edge function
  edge_function_url := 'https://rxwmzfaghsdouepbfrnr.supabase.co/functions/v1/send-email-notification';
  
  -- Build the webhook payload
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', to_jsonb(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END
  );
  
  -- Make async HTTP POST to edge function with proper headers
  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, current_setting('supabase.service_role_key', true))
    ),
    body := payload
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Email notification trigger failed: %', SQLERRM;
    RETURN NEW;
END;
$function$;