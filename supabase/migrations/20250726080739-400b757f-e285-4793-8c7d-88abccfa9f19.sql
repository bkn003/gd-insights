-- Fix infinite recursion in RLS policies by using security definer functions

-- Drop all problematic policies
DROP POLICY IF EXISTS "Admins can view all shops including deleted" ON public.shops;
DROP POLICY IF EXISTS "Admins can view all categories including deleted" ON public.categories;
DROP POLICY IF EXISTS "Admins can view all sizes including deleted" ON public.sizes;
DROP POLICY IF EXISTS "Admins can view all profiles including deleted" ON public.profiles;

-- Recreate policies using the existing security definer function
CREATE POLICY "Admins can view all shops including deleted"
ON public.shops
FOR SELECT
USING (get_current_user_role() = 'admin');

CREATE POLICY "Admins can view all categories including deleted"
ON public.categories
FOR SELECT
USING (get_current_user_role() = 'admin');

CREATE POLICY "Admins can view all sizes including deleted"
ON public.sizes
FOR SELECT
USING (get_current_user_role() = 'admin');

CREATE POLICY "Admins can view all profiles including deleted"
ON public.profiles
FOR SELECT
USING (get_current_user_role() = 'admin');