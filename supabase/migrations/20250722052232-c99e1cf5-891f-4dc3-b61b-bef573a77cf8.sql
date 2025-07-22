
-- Add the missing employee_name column to goods_damaged_entries table
ALTER TABLE public.goods_damaged_entries 
ADD COLUMN employee_name TEXT;

-- Update existing entries to populate employee_name from profiles table
UPDATE public.goods_damaged_entries 
SET employee_name = profiles.name 
FROM public.profiles 
WHERE goods_damaged_entries.employee_id = profiles.id 
AND goods_damaged_entries.employee_name IS NULL;
