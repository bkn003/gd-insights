-- Add SELECT policy for managers to view images for entries in their shop
-- This fixes the issue where managers cannot see images in Dashboard/Reports

DROP POLICY IF EXISTS "Managers can view images for their shop entries" ON public.gd_entry_images;

CREATE POLICY "Managers can view images for their shop entries"
ON public.gd_entry_images
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.goods_damaged_entries gde
    JOIN public.profiles p ON p.shop_id = gde.shop_id
    WHERE gde.id = gd_entry_images.gd_entry_id
    AND p.id = auth.uid()
    AND p.role = 'manager'
  )
);

-- Also add a general SELECT policy for users who created the entry
DROP POLICY IF EXISTS "Users can view images for their entries" ON public.gd_entry_images;

CREATE POLICY "Users can view images for their entries"
ON public.gd_entry_images
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.goods_damaged_entries gde
    WHERE gde.id = gd_entry_images.gd_entry_id
    AND gde.employee_id = auth.uid()
  )
);
