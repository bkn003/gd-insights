-- Add voice_note_url column to goods_damaged_entries
ALTER TABLE public.goods_damaged_entries 
ADD COLUMN voice_note_url TEXT;

-- Create storage bucket for voice notes
INSERT INTO storage.buckets (id, name, public) 
VALUES ('gd-voice-notes', 'gd-voice-notes', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload voice notes
CREATE POLICY "Users can upload voice notes"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'gd-voice-notes' AND 
  auth.role() = 'authenticated'
);

-- Allow public read access
CREATE POLICY "Anyone can read voice notes"
ON storage.objects FOR SELECT
USING (bucket_id = 'gd-voice-notes');

-- Allow users to delete their own voice notes
CREATE POLICY "Users can delete their voice notes"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'gd-voice-notes' AND 
  auth.role() = 'authenticated'
);

-- Add admin policy for voice note images management
CREATE POLICY "Admins can manage voice notes"
ON storage.objects FOR ALL
USING (
  bucket_id = 'gd-voice-notes' AND 
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);