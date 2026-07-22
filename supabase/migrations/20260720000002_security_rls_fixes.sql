-- =============================================================================
-- Security RLS Fixes Batch
-- 1. Fix reports policies: add super_admin to direct subquery
-- 2. Fix user_roles SELECT policy: add super_admin and use has_role()
-- 3. Fix platform_settings SELECT policy: restrict to authenticated users only
-- =============================================================================

-- ========================================
-- 1. Reports: add super_admin to direct subquery (H3)
-- ========================================
DROP POLICY IF EXISTS "Admins can view all reports" ON public.reports;
CREATE POLICY "Admins can view all reports" ON public.reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'moderator', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Admins can update reports" ON public.reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'moderator', 'super_admin')
    )
  );

-- ========================================
-- 2. user_roles: fix SELECT policy to use has_role() (H4)
-- This prevents non-admin users from enumerating all roles
-- and ensures super_admin + moderator are also covered
-- ========================================
DROP POLICY IF EXISTS "Users can view own role, admins view all" ON public.user_roles;
CREATE POLICY "Users can view own role, admins view all" ON public.user_roles
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
  );

-- ========================================
-- 3. platform_settings: restrict to authenticated users (H5)
-- ========================================
DROP POLICY IF EXISTS "Anyone can read settings" ON public.platform_settings;
CREATE POLICY "Anyone can read settings" ON public.platform_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- ========================================
-- 4. Delete accounts: filter out deleted profiles from public view (M4)
-- ========================================
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id AND (is_deleted IS NOT TRUE OR is_deleted IS NULL));

DROP POLICY IF EXISTS "Rental participants can view each other's profiles" ON public.profiles;
CREATE POLICY "Rental participants can view each other's profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.rentals
      WHERE (renter_id = auth.uid() OR owner_id = auth.uid())
        AND (profiles.id = rentals.renter_id OR profiles.id = rentals.owner_id)
        AND status IN ('approved', 'active', 'paid', 'completed')
    )
    AND (profiles.is_deleted IS NOT TRUE OR profiles.is_deleted IS NULL)
  );
