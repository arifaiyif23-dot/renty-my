-- Fix RLS policies that use USING (true) / WITH CHECK (true) on sensitive tables
-- These allowed any authenticated user to insert/update sensitive data

-- Fix listing_analytics: only system/service_role can insert/update
DROP POLICY IF EXISTS "System can insert analytics" ON listing_analytics;
DROP POLICY IF EXISTS "System can update analytics" ON listing_analytics;

-- Allow inserts from edge functions using service_role key
CREATE POLICY "Service role can insert analytics"
ON listing_analytics FOR INSERT
WITH CHECK (true);

-- Allow updates from edge functions using service_role key
CREATE POLICY "Service role can update analytics"
ON listing_analytics FOR UPDATE
USING (true);

-- Revoke direct insert/update from public/authenticated roles
ALTER TABLE listing_analytics ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE ON listing_analytics FROM anon, authenticated;

-- Fix notifications: only system/service_role can create
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- Allow inserts from edge functions using service_role key
CREATE POLICY "Service role can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Revoke direct insert from public/authenticated roles
REVOKE INSERT ON public.notifications FROM anon, authenticated;
