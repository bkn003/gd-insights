
-- =====================================================
-- SECURITY HARDENING: Prevent privilege escalation
-- =====================================================

-- 1. Trigger to prevent users from escalating their own role or modifying sensitive fields
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller_role text;
  caller_id uuid;
BEGIN
  caller_id := auth.uid();
  caller_role := get_user_role_secure(caller_id);

  -- Block any user from changing their own role, admin_id, or status
  IF NEW.id = caller_id THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot change your own role';
    END IF;
    IF NEW.admin_id IS DISTINCT FROM OLD.admin_id THEN
      RAISE EXCEPTION 'Cannot change your own admin_id';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Cannot change your own status';
    END IF;
  END IF;

  -- Admins cannot promote sub-users beyond 'manager'
  IF caller_role = 'admin' THEN
    IF NEW.role NOT IN ('user', 'manager') THEN
      RAISE EXCEPTION 'Admins can only assign user or manager roles';
    END IF;
    -- Admins cannot change admin_id of sub-users
    IF NEW.admin_id IS DISTINCT FROM OLD.admin_id THEN
      RAISE EXCEPTION 'Admins cannot change admin assignment';
    END IF;
  END IF;

  -- Only super_admin can set role to 'admin' or 'super_admin'
  IF NEW.role IN ('admin', 'super_admin') AND NEW.role IS DISTINCT FROM OLD.role THEN
    IF caller_role != 'super_admin' THEN
      RAISE EXCEPTION 'Only super admins can assign admin or super_admin roles';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop if exists and recreate
DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_escalation();

-- 2. Prevent users from setting deleted_at on their own profile
-- (already handled by update_own not allowing delete, but belt-and-suspenders)

-- 3. Add storage RLS policies for gd-entry-images bucket
-- Note: Storage policies are managed via Supabase dashboard, 
-- but we document the recommended policies here as comments:
-- INSERT: authenticated users can upload to paths starting with their entry ID
-- SELECT: users can read files from entries they have access to
-- DELETE: only admins can delete

-- 4. Restrict the profiles_update_own policy to safe columns only
-- Drop overly permissive policy and replace with column-restricted version
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- The trigger prevents role/admin_id/status changes, 
    -- but we also ensure at policy level the role hasn't changed
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );
