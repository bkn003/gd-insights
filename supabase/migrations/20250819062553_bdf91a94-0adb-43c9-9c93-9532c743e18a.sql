
-- Create table for storing multiple images per GD entry
CREATE TABLE public.gd_entry_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gd_entry_id UUID NOT NULL REFERENCES goods_damaged_entries(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_name TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS)
ALTER TABLE public.gd_entry_images ENABLE ROW LEVEL SECURITY;

-- Create policies for gd_entry_images
CREATE POLICY "Admins can manage all entry images" 
  ON public.gd_entry_images 
  FOR ALL 
  USING (get_current_user_role() = 'admin'::text);

CREATE POLICY "Users can insert images for their shop entries" 
  ON public.gd_entry_images 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM goods_damaged_entries 
      WHERE id = gd_entry_id 
      AND shop_id = get_current_user_shop_id() 
      AND employee_id = auth.uid()
    )
  );

-- Add updated_at trigger for gd_entry_images
CREATE TRIGGER update_gd_entry_images_updated_at 
  BEFORE UPDATE ON public.gd_entry_images 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for GD entry images if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('gd-entry-images', 'gd-entry-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the storage bucket
CREATE POLICY "Authenticated users can upload images" 
  ON storage.objects 
  FOR INSERT 
  WITH CHECK (
    bucket_id = 'gd-entry-images' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Public can view images" 
  ON storage.objects 
  FOR SELECT 
  USING (bucket_id = 'gd-entry-images');

CREATE POLICY "Users can delete their own images" 
  ON storage.objects 
  FOR DELETE 
  USING (
    bucket_id = 'gd-entry-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
