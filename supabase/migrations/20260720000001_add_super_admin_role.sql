-- Add super_admin role to app_role enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE typname = 'app_role' AND enumlabel = 'super_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'super_admin';
  END IF;
END $$;

-- Create admin_permissions table for granular permission control
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  permission TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, permission)
);

ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

-- Only super_admins can manage admin_permissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'admin_permissions' AND policyname = 'Super admins can manage admin permissions'
  ) THEN
    CREATE POLICY "Super admins can manage admin permissions" ON public.admin_permissions
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'super_admin'
        )
      );
  END IF;
END $$;

-- Only super_admins can view admin_permissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'admin_permissions' AND policyname = 'Super admins can view admin permissions'
  ) THEN
    CREATE POLICY "Super admins can view admin permissions" ON public.admin_permissions
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'super_admin'
        )
      );
  END IF;
END $$;

-- Update has_role function: checking for 'admin' also returns true for 'super_admin'
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND (
      role = _role
      OR (_role = 'admin' AND role = 'super_admin')
    )
  )
$$;

-- Create function to check if user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- Create function to check if user has a specific admin permission
CREATE OR REPLACE FUNCTION public.has_admin_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
  OR EXISTS (
    SELECT 1
    FROM public.admin_permissions
    WHERE user_id = _user_id AND permission = _permission
  )
$$;

-- Seed arifaiyif03@gmail.com as super_admin
DO $$
DECLARE
  admin_uid UUID;
BEGIN
  SELECT id INTO admin_uid FROM auth.users WHERE email = 'arifaiyif03@gmail.com';
  IF admin_uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_uid, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;
