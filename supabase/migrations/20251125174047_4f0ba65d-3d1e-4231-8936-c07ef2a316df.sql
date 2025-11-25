-- Enable pg_net extension for HTTP requests from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant permissions for pg_net usage
GRANT USAGE ON SCHEMA net TO postgres, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO postgres, service_role;

-- Create function to send webhook notifications
CREATE OR REPLACE FUNCTION public.notify_rental_changes()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  payload jsonb;
  edge_function_url text;
BEGIN
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
  
  -- Make async HTTP POST to edge function
  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := payload
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for new rental requests (INSERT)
CREATE TRIGGER on_rental_insert_notify
  AFTER INSERT ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_rental_changes();

-- Create trigger for status changes (UPDATE)
CREATE TRIGGER on_rental_update_notify
  AFTER UPDATE ON public.rentals
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_rental_changes();