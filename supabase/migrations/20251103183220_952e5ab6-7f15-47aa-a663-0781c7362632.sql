-- Add admin role for arifaiyif03@gmail.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('0486212d-ed2f-4c4d-8d2e-e0bdc95b3392', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;