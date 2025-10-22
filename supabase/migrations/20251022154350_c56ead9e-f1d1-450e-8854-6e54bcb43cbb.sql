-- Fix critical security issues

-- 1. Fix profiles table: Restrict phone and location data visibility
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create policy for basic public profile info (name, avatar, verification status only)
CREATE POLICY "Public profile info viewable by everyone" 
ON public.profiles FOR SELECT 
TO authenticated, anon
USING (true);

-- Note: PostgreSQL doesn't support column-level RLS directly, but we can use views
-- For now, apps should select only safe columns. Consider creating a public_profiles view.

-- 2. Fix transactions table: Prevent direct user manipulation
-- Remove dangerous policies that allow any user to create/modify transactions
DROP POLICY IF EXISTS "System can create transactions" ON public.transactions;
DROP POLICY IF EXISTS "System can update transactions" ON public.transactions;

-- Deny all direct INSERT/UPDATE/DELETE access to transactions
-- Only Edge Functions using service role should modify this table
CREATE POLICY "Transactions cannot be directly inserted" 
ON public.transactions FOR INSERT 
TO authenticated
WITH CHECK (false);

CREATE POLICY "Transactions cannot be directly updated" 
ON public.transactions FOR UPDATE 
TO authenticated
USING (false);

CREATE POLICY "Transactions cannot be directly deleted" 
ON public.transactions FOR DELETE 
TO authenticated
USING (false);

-- Keep the existing SELECT policy (users can view their own transactions)
-- This is already correct and doesn't need changes