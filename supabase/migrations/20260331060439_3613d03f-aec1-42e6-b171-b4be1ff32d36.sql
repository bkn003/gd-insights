
-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can read audit logs
CREATE POLICY "sa_audit_logs_select" ON public.audit_logs FOR SELECT
  USING (is_super_admin(auth.uid()));

-- Any authenticated user can insert audit logs (for their own actions)
CREATE POLICY "authenticated_insert_audit" ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Super admins can insert audit logs for any user
CREATE POLICY "sa_audit_logs_insert" ON public.audit_logs FOR INSERT
  WITH CHECK (is_super_admin(auth.uid()));

-- Index for performance
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- ============================================
-- SIGNUP VISIBILITY GLOBAL SETTING
-- ============================================
-- We'll use a special app_settings row with admin_id = NULL for global settings
-- Insert default: signup is visible
INSERT INTO public.app_settings (key, value, admin_id)
VALUES ('signup_enabled', 'true'::jsonb, NULL)
ON CONFLICT DO NOTHING;

-- Allow super admin to manage global settings (admin_id IS NULL)
CREATE POLICY "sa_global_settings_all" ON public.app_settings FOR ALL
  USING (is_super_admin(auth.uid()) AND admin_id IS NULL)
  WITH CHECK (is_super_admin(auth.uid()) AND admin_id IS NULL);

-- Allow anyone to read the signup_enabled setting (needed for login page)
CREATE POLICY "public_read_signup_setting" ON public.app_settings FOR SELECT
  USING (key = 'signup_enabled' AND admin_id IS NULL);
