
-- Add max_images_total column to profiles for tenant-level image limit
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_images_total integer DEFAULT NULL;

-- Storage bucket security: Make buckets private and add RLS policies
-- First update buckets to not be public
UPDATE storage.buckets SET public = false WHERE id IN ('gd-images', 'gd-entry-images', 'gd-voice-notes');

-- Drop existing storage policies if any
DROP POLICY IF EXISTS "Allow authenticated users to upload gd-entry-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view gd-entry-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete gd-entry-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload gd-voice-notes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view gd-voice-notes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete gd-voice-notes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload gd-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view gd-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete gd-images" ON storage.objects;

-- Storage RLS: gd-entry-images
CREATE POLICY "auth_upload_gd_entry_images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gd-entry-images');

CREATE POLICY "auth_select_gd_entry_images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'gd-entry-images');

CREATE POLICY "auth_delete_gd_entry_images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'gd-entry-images');

-- Storage RLS: gd-voice-notes
CREATE POLICY "auth_upload_gd_voice_notes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gd-voice-notes');

CREATE POLICY "auth_select_gd_voice_notes" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'gd-voice-notes');

CREATE POLICY "auth_delete_gd_voice_notes" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'gd-voice-notes');

-- Storage RLS: gd-images (legacy bucket)
CREATE POLICY "auth_upload_gd_images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gd-images');

CREATE POLICY "auth_select_gd_images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'gd-images');

CREATE POLICY "auth_delete_gd_images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'gd-images');
