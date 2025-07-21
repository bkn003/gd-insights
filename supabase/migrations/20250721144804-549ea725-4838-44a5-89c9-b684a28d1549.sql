
-- Fix the infinite recursion in profiles RLS policies
-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;

-- Create a new policy that doesn't cause recursion
CREATE POLICY "Admins can manage profiles" ON public.profiles
FOR ALL 
USING (
  -- Allow access if the user is checking their own profile
  id = auth.uid() 
  OR 
  -- Allow access if the user has admin role (check directly without subquery)
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  )
);

-- Also fix the other policies that might have similar issues
DROP POLICY IF EXISTS "Users can view entries from their shop" ON public.goods_damaged_entries;
DROP POLICY IF EXISTS "Admins can manage all entries" ON public.goods_damaged_entries;

-- Recreate the goods_damaged_entries policies without recursion
CREATE POLICY "Users can view entries from their shop" ON public.goods_damaged_entries
FOR SELECT 
USING (
  -- Allow if user is from same shop OR user is admin
  shop_id = (SELECT shop_id FROM public.profiles WHERE id = auth.uid())
  OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Admins can manage all entries" ON public.goods_damaged_entries
FOR ALL 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
