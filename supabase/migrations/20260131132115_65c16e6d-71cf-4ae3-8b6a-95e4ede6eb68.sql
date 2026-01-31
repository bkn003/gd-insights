-- Drop the problematic recursive policies on profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles including deleted" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view shop profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;

-- Drop problematic policies on app_settings that also cause recursion
DROP POLICY IF EXISTS "Only admins can view app_settings" ON public.app_settings;

-- Create/Replace secure helper functions that bypass RLS for role checking
CREATE OR REPLACE FUNCTION public.get_user_role_secure(user_uuid uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = user_uuid AND deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_user_shop_id_secure(user_uuid uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT shop_id FROM public.profiles WHERE id = user_uuid AND deleted_at IS NULL;
$$;

-- Simple non-recursive policies for profiles table
-- 1. Users can view their own profile
CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- 2. Admins can view all profiles (using SECURITY DEFINER function to avoid recursion)
CREATE POLICY "profiles_select_admin"
ON public.profiles FOR SELECT
USING (public.get_user_role_secure(auth.uid()) = 'admin');

-- 3. Managers can view profiles in their shop (using SECURITY DEFINER function)
CREATE POLICY "profiles_select_manager_shop"
ON public.profiles FOR SELECT
USING (
  public.get_user_role_secure(auth.uid()) = 'manager' 
  AND shop_id = public.get_user_shop_id_secure(auth.uid())
);

-- 4. Users can update their own profile
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 5. Admins can update any profile
CREATE POLICY "profiles_update_admin"
ON public.profiles FOR UPDATE
USING (public.get_user_role_secure(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role_secure(auth.uid()) = 'admin');

-- 6. Admins can insert profiles
CREATE POLICY "profiles_insert_admin"
ON public.profiles FOR INSERT
WITH CHECK (public.get_user_role_secure(auth.uid()) = 'admin');

-- 7. Allow users to insert their own profile during signup
CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- 8. Admins can delete profiles
CREATE POLICY "profiles_delete_admin"
ON public.profiles FOR DELETE
USING (public.get_user_role_secure(auth.uid()) = 'admin');

-- Fix app_settings policy to use secure function
CREATE POLICY "app_settings_select_admin"
ON public.app_settings FOR SELECT
USING (public.get_user_role_secure(auth.uid()) = 'admin');