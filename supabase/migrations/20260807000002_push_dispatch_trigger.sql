-- Dispatch push to the send-push-notification edge function
-- whenever a row is inserted into public.notifications. Mirrors the email
-- notification webhook pattern, but uses pg_net so it works from the DB.
--
-- Secret-based auth (WEBHOOK_SECRET) matches send-email-notification.
-- The secret must be configured as Postgres setting webhook.secret
-- (e.g. `ALTER DATABASE postgres SET webhook.secret = '<value>';`).

create extension if not exists pg_net;

-- The edge function env secret WEBHOOK_SECRET must equal this DB setting,
-- or the fail-closed auth gate will reject the trigger's dispatch.
ALTER DATABASE postgres SET webhook.secret = '<MATCH-EDGE-FUNCTION-WEBHOOK_SECRET>';

create or replace function public.dispatch_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  edge_fn text := 'https://gsucsqtqtpaeuxwrykmf.supabase.co/functions/v1/send-push-notification';
  secret text := current_setting('webhook.secret', true);
begin
  if secret is null or secret = '' then
    return null;
  end if;

  perform
    net.http_post(
      url := edge_fn,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', secret
      ),
      body := jsonb_build_object(
        'user_id', new.user_id,
        'type', new.type,
        'title', new.title,
        'body', new.message,
        'link', new.link
      )
    );
  return null;
end;
$$;

drop trigger if exists on_notification_insert_dispatch_push
  on public.notifications;

create trigger on_notification_insert_dispatch_push
  after insert on public.notifications
  for each row execute function public.dispatch_push_notification();