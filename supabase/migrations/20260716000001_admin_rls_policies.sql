-- Admin RLS Policies for MVP admin panel
-- These policies grant admins the necessary access to manage the platform
-- without relying solely on service_role edge functions for read operations.

-- 1. Profiles: Allow admins to update any profile (for manual verification, etc.)
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- 2. Items: Allow admins to update any item (for hide/show moderation)
CREATE POLICY "Admins can update all items" ON items
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- 3. Rentals: Allow admins to view all rentals (for booking monitoring)
CREATE POLICY "Admins can view all rentals" ON rentals
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- 4. Payments: Allow admins to view all payments (for payment monitoring)
CREATE POLICY "Admins can view all payments" ON payments
  FOR SELECT USING (has_role(auth.uid(), 'admin'));
