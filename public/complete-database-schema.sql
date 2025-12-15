-- ============================================
-- COMPLETE DATABASE SCHEMA FOR GD APP
-- Copy and paste this SQL into a new Supabase project
-- ============================================

-- ============================================
-- PART 1: HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Function to get current user shop_id
CREATE OR REPLACE FUNCTION public.get_current_user_shop_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT shop_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, user_id, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'user_id', NEW.email),
    'user'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(NEW.raw_user_meta_data->>'name', profiles.name),
    user_id = COALESCE(NEW.raw_user_meta_data->>'user_id', NEW.email),
    deleted_at = NULL,
    updated_at = now();
  RETURN NEW;
END;
$$;

-- Function to prevent hard delete of users with GD entries
CREATE OR REPLACE FUNCTION public.prevent_user_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Check if user has any GD entries
  IF EXISTS (
    SELECT 1 FROM public.goods_damaged_entries 
    WHERE employee_id = OLD.id
  ) THEN
    -- Instead of hard delete, do soft delete
    UPDATE public.profiles 
    SET deleted_at = now(), updated_at = now()
    WHERE id = OLD.id;
    
    -- Prevent the actual deletion
    RETURN NULL;
  END IF;
  
  -- Allow deletion if no GD entries exist
  RETURN OLD;
END;
$$;

-- ============================================
-- PART 2: CREATE TABLES
-- ============================================

-- Shops table
CREATE TABLE IF NOT EXISTS public.shops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Sizes table
CREATE TABLE IF NOT EXISTS public.sizes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  size TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Customer types table
CREATE TABLE IF NOT EXISTS public.customer_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Profiles table (user profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  email TEXT,
  shop_id UUID,
  default_category_id UUID,
  default_size_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Goods damaged entries table
CREATE TABLE IF NOT EXISTS public.goods_damaged_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL,
  size_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  employee_name TEXT,
  shop_id UUID NOT NULL,
  customer_type_id UUID,
  notes TEXT NOT NULL,
  image_url TEXT,
  voice_note_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- GD entry images table (multiple images per entry)
CREATE TABLE IF NOT EXISTS public.gd_entry_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gd_entry_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  image_name TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- PART 3: ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_damaged_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gd_entry_images ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 4: CREATE RLS POLICIES
-- ============================================

-- SHOPS POLICIES
CREATE POLICY "Admins can manage shops" ON public.shops FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can view all shops including deleted" ON public.shops FOR SELECT
USING (get_current_user_role() = 'admin');

CREATE POLICY "Users can view active shops" ON public.shops FOR SELECT
USING (deleted_at IS NULL);

-- CATEGORIES POLICIES
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can view all categories including deleted" ON public.categories FOR SELECT
USING (get_current_user_role() = 'admin');

CREATE POLICY "Users can view active categories" ON public.categories FOR SELECT
USING (deleted_at IS NULL);

-- SIZES POLICIES
CREATE POLICY "Admins can manage sizes" ON public.sizes FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can view all sizes including deleted" ON public.sizes FOR SELECT
USING (get_current_user_role() = 'admin');

CREATE POLICY "Users can view active sizes" ON public.sizes FOR SELECT
USING (deleted_at IS NULL);

-- CUSTOMER TYPES POLICIES
CREATE POLICY "Admins can manage customer types" ON public.customer_types FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can view all customer types including deleted" ON public.customer_types FOR SELECT
USING (get_current_user_role() = 'admin');

CREATE POLICY "Users can view active customer types" ON public.customer_types FOR SELECT
USING (deleted_at IS NULL);

-- PROFILES POLICIES
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL
USING ((id = auth.uid()) OR (get_current_user_role() = 'admin'));

CREATE POLICY "Admins can view all profiles including deleted" ON public.profiles FOR SELECT
USING (get_current_user_role() = 'admin');

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE
USING (id = auth.uid());

CREATE POLICY "Users can view active profiles" ON public.profiles FOR SELECT
USING ((deleted_at IS NULL) OR (id = auth.uid()));

-- GOODS DAMAGED ENTRIES POLICIES
CREATE POLICY "Admins can manage all entries" ON public.goods_damaged_entries FOR ALL
USING (get_current_user_role() = 'admin');

CREATE POLICY "Admins can view all entries" ON public.goods_damaged_entries FOR SELECT
USING (get_current_user_role() = 'admin');

CREATE POLICY "Users can create entries for their shop" ON public.goods_damaged_entries FOR INSERT
WITH CHECK ((shop_id = get_current_user_shop_id()) AND (employee_id = auth.uid()));

CREATE POLICY "Users cannot view entries" ON public.goods_damaged_entries FOR SELECT
USING (false);

-- GD ENTRY IMAGES POLICIES
CREATE POLICY "Admins can manage all entry images" ON public.gd_entry_images FOR ALL
USING (get_current_user_role() = 'admin');

CREATE POLICY "Users can insert images for their shop entries" ON public.gd_entry_images FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM goods_damaged_entries
  WHERE goods_damaged_entries.id = gd_entry_images.gd_entry_id
  AND goods_damaged_entries.shop_id = get_current_user_shop_id()
  AND goods_damaged_entries.employee_id = auth.uid()
));

-- ============================================
-- PART 5: CREATE TRIGGERS
-- ============================================

-- Updated_at triggers
CREATE TRIGGER update_shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sizes_updated_at
  BEFORE UPDATE ON public.sizes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_types_updated_at
  BEFORE UPDATE ON public.customer_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goods_damaged_entries_updated_at
  BEFORE UPDATE ON public.goods_damaged_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gd_entry_images_updated_at
  BEFORE UPDATE ON public.gd_entry_images
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Prevent hard delete trigger for profiles
CREATE TRIGGER prevent_user_hard_delete_trigger
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_user_hard_delete();

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- PART 6: STORAGE BUCKETS
-- ============================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('gd-images', 'gd-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('gd-entry-images', 'gd-entry-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('gd-voice-notes', 'gd-voice-notes', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PART 7: STORAGE POLICIES
-- ============================================

-- gd-entry-images bucket policies
CREATE POLICY "Users can upload entry images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'gd-entry-images' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can read entry images"
ON storage.objects FOR SELECT
USING (bucket_id = 'gd-entry-images');

CREATE POLICY "Users can delete their entry images"
ON storage.objects FOR DELETE
USING (bucket_id = 'gd-entry-images' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can manage entry images"
ON storage.objects FOR ALL
USING (bucket_id = 'gd-entry-images' AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- gd-voice-notes bucket policies
CREATE POLICY "Users can upload voice notes"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'gd-voice-notes' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can read voice notes"
ON storage.objects FOR SELECT
USING (bucket_id = 'gd-voice-notes');

CREATE POLICY "Users can delete their voice notes"
ON storage.objects FOR DELETE
USING (bucket_id = 'gd-voice-notes' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can manage voice notes"
ON storage.objects FOR ALL
USING (bucket_id = 'gd-voice-notes' AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- gd-images bucket policies (legacy)
CREATE POLICY "Users can upload images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'gd-images' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can read images"
ON storage.objects FOR SELECT
USING (bucket_id = 'gd-images');

-- ============================================
-- PART 8: SAMPLE DATA (Optional - uncomment if needed)
-- ============================================

-- Uncomment below to add sample data for testing

-- INSERT INTO public.shops (name) VALUES 
-- ('Main Store'),
-- ('Small Shop'),
-- ('Big Outlet');

-- INSERT INTO public.categories (name) VALUES 
-- ('PANT'),
-- ('SHIRT'),
-- ('T-SHIRT'),
-- ('JEANS');

-- INSERT INTO public.sizes (size) VALUES 
-- ('S'),
-- ('M'),
-- ('L'),
-- ('XL'),
-- ('XXL'),
-- ('28'),
-- ('30'),
-- ('32'),
-- ('34'),
-- ('36'),
-- ('38'),
-- ('40'),
-- ('42'),
-- ('44');

-- INSERT INTO public.customer_types (name) VALUES 
-- ('HINDI'),
-- ('TAMIL'),
-- ('ENGLISH'),
-- ('TELUGU');

-- ============================================
-- NOTES:
-- 1. Run this SQL in a fresh Supabase project
-- 2. Make sure to enable Email auth in Authentication settings
-- 3. The first user to sign up will need to be manually set as admin:
--    UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
-- 4. Configure your frontend to point to the new Supabase project
-- ============================================
