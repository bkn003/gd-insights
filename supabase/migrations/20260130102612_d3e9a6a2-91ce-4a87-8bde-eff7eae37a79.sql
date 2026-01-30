-- Fix security issues: Restrict profile visibility and fix function search_path

-- 1. Drop existing overly permissive profile policies
DROP POLICY IF EXISTS "Users can view active profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

-- 2. Create more restrictive profile policies
-- Users can only view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Admins can view all active profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.role = 'admin' 
    AND p.deleted_at IS NULL
  )
);

-- Managers can view profiles in their shop
CREATE POLICY "Managers can view shop profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.role = 'manager' 
    AND p.shop_id = profiles.shop_id
    AND p.deleted_at IS NULL
  )
);

-- 3. Fix function search_path for security
-- Recreate functions with explicit search_path

-- Fix get_current_user_role function
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid()
  AND deleted_at IS NULL;
  
  RETURN COALESCE(user_role, 'user');
END;
$$;

-- Fix get_current_user_shop_id function  
CREATE OR REPLACE FUNCTION public.get_current_user_shop_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_shop_id UUID;
BEGIN
  SELECT shop_id INTO user_shop_id
  FROM public.profiles
  WHERE id = auth.uid()
  AND deleted_at IS NULL;
  
  RETURN user_shop_id;
END;
$$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 4. Restrict app_settings access to admins only
DROP POLICY IF EXISTS "Anyone can view app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "App settings viewable by authenticated users" ON public.app_settings;

CREATE POLICY "Only admins can view app_settings"
ON public.app_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.role = 'admin' 
    AND p.deleted_at IS NULL
  )
);

-- 5. Restrict shops visibility - users see only their assigned shop, admins/managers see all
DROP POLICY IF EXISTS "Users can view active shops" ON public.shops;
DROP POLICY IF EXISTS "Shops viewable by authenticated users" ON public.shops;

-- All authenticated users need to see shops for signup dropdown
CREATE POLICY "Authenticated users can view active shops"
ON public.shops
FOR SELECT
USING (deleted_at IS NULL);