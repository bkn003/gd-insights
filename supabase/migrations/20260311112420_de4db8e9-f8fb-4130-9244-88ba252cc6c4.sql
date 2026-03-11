
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_entries integer DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_images_per_entry integer DEFAULT 10;
