-- Cleanup orphan verification_requests that were never processed by AI
-- These occur when the user closes the tab between the client-side insert
-- and the submit-verification edge function call.

-- Also handles rows stuck in 'processing' (edge fn crashed mid-flight).

create or replace function cleanup_orphan_verifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  -- Orphan: inserted by client but submit-verification never ran
  delete from verification_requests
  where status = 'pending'
    and ai_analysis_result is null
    and created_at < now() - interval '24 hours';
  get diagnostics deleted_count = row_count;

  -- Stuck in processing: edge fn called but never completed
  delete from verification_requests
  where status = 'processing'
    and created_at < now() - interval '1 hour';

  return deleted_count;
end;
$$;
