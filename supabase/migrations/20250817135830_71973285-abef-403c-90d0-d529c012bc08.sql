
-- Add image_url column to goods_damaged_entries table
ALTER TABLE public.goods_damaged_entries 
ADD COLUMN image_url TEXT;

-- Create storage bucket for GD images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('gd-images', 'gd-images', true);

-- Create RLS policy for GD images bucket - users can upload to their own folder
CREATE POLICY "Users can upload GD images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'gd-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create RLS policy for GD images bucket - users can view all images (for reports)
CREATE POLICY "Users can view GD images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'gd-images');

-- Create RLS policy for GD images bucket - users can delete their own images
CREATE POLICY "Users can delete own GD images" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'gd-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
