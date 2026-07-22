-- ========================================
-- Add admin-level SELECT policies for tables that admin pages query directly
-- ========================================

-- 1. Profiles: admins need to view all profiles (user list, profile details)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (has_role(auth.uid(), 'admin'));
