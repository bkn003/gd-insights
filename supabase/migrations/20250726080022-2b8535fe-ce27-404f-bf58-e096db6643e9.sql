
-- Add default category and size columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN default_category_id uuid REFERENCES public.categories(id),
ADD COLUMN default_size_id uuid REFERENCES public.sizes(id);

-- Add soft delete columns to all relevant tables
ALTER TABLE public.shops ADD COLUMN deleted_at timestamp with time zone;
ALTER TABLE public.categories ADD COLUMN deleted_at timestamp with time zone;
ALTER TABLE public.sizes ADD COLUMN deleted_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN deleted_at timestamp with time zone;

-- Update RLS policies to exclude soft-deleted items from general view
DROP POLICY IF EXISTS "Users can view shops" ON public.shops;
CREATE POLICY "Users can view active shops"
ON public.shops
FOR SELECT
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can view categories" ON public.categories;
CREATE POLICY "Users can view active categories"
ON public.categories
FOR SELECT
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can view sizes" ON public.sizes;
CREATE POLICY "Users can view active sizes"
ON public.sizes
FOR SELECT
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view active profiles"
ON public.profiles
FOR SELECT
USING (deleted_at IS NULL);

-- Add policies for admins to view all items including soft-deleted ones
CREATE POLICY "Admins can view all shops including deleted"
ON public.shops
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'admin'
  AND profiles.deleted_at IS NULL
));

CREATE POLICY "Admins can view all categories including deleted"
ON public.categories
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'admin'
  AND profiles.deleted_at IS NULL
));

CREATE POLICY "Admins can view all sizes including deleted"
ON public.sizes
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'admin'
  AND profiles.deleted_at IS NULL
));

CREATE POLICY "Admins can view all profiles including deleted"
ON public.profiles
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles p2
  WHERE p2.id = auth.uid() 
  AND p2.role = 'admin'
  AND p2.deleted_at IS NULL
));
