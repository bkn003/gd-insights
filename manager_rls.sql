-- Enable RLS on goods_damaged_entries if not already enabled
ALTER TABLE public.goods_damaged_entries ENABLE ROW LEVEL SECURITY;

-- 1. Policy for Managers to VIEW data from their assigned shop
DROP POLICY IF EXISTS "Managers can view their shop data" ON public.goods_damaged_entries;
CREATE POLICY "Managers can view their shop data"
ON public.goods_damaged_entries
FOR SELECT
TO authenticated
USING (
  shop_id IN (
    SELECT shop_id FROM public.profiles 
    WHERE id = auth.uid() AND role = 'manager'
  )
);

-- 2. Policy for Managers to INSERT data for their assigned shop
DROP POLICY IF EXISTS "Managers can insert for their shop" ON public.goods_damaged_entries;
CREATE POLICY "Managers can insert for their shop"
ON public.goods_damaged_entries
FOR INSERT
TO authenticated
WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM public.profiles 
    WHERE id = auth.uid() AND role = 'manager'
  )
);

-- 3. Policy for Managers to UPDATE data for their assigned shop (optional, good for corrections)
DROP POLICY IF EXISTS "Managers can update their shop data" ON public.goods_damaged_entries;
CREATE POLICY "Managers can update their shop data"
ON public.goods_damaged_entries
FOR UPDATE
TO authenticated
USING (
  shop_id IN (
    SELECT shop_id FROM public.profiles 
    WHERE id = auth.uid() AND role = 'manager'
  )
);

-- 4. Policy for Admins (Ensure Admins can still see everything)
-- Note: Often admins have a "service_role" or specific admin policy. Adding this ensures specific "admin" role access.
DROP POLICY IF EXISTS "Admins can do everything" ON public.goods_damaged_entries;
CREATE POLICY "Admins can do everything"
ON public.goods_damaged_entries
FOR ALL
TO authenticated
USING (
  exists (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);
