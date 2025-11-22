-- Fix search_path security warnings for new functions
ALTER FUNCTION update_escrow_updated_at() SET search_path = public;
ALTER FUNCTION freeze_escrow_on_dispute() SET search_path = public;
ALTER FUNCTION check_escrow_auto_release() SET search_path = public;