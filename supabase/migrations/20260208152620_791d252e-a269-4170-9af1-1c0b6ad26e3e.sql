
-- ==========================================
-- MULTI-TENANT SAAS CONVERSION MIGRATION
-- ==========================================

-- 1. ADD SaaS COLUMNS TO PROFILES
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS admin_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS max_shops integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_users integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('super_admin', 'admin', 'manager', 'user'));

DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check 
    CHECK (status IN ('active', 'paused'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. ADD admin_id TO ALL TENANT TABLES
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS admin_id uuid;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS admin_id uuid;
ALTER TABLE public.sizes ADD COLUMN IF NOT EXISTS admin_id uuid;
ALTER TABLE public.customer_types ADD COLUMN IF NOT EXISTS admin_id uuid;
ALTER TABLE public.goods_damaged_entries ADD COLUMN IF NOT EXISTS admin_id uuid;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS admin_id uuid;

-- 3. MIGRATE EXISTING DATA (assign all to first admin)
DO $$
DECLARE
  v_admin_id uuid;
BEGIN
  SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'admin' AND deleted_at IS NULL LIMIT 1;
  
  IF v_admin_id IS NOT NULL THEN
    UPDATE public.profiles SET admin_id = v_admin_id WHERE id = v_admin_id AND admin_id IS NULL;
    UPDATE public.profiles SET admin_id = v_admin_id WHERE role IN ('manager', 'user') AND admin_id IS NULL AND deleted_at IS NULL;
    UPDATE public.shops SET admin_id = v_admin_id WHERE admin_id IS NULL;
    UPDATE public.categories SET admin_id = v_admin_id WHERE admin_id IS NULL;
    UPDATE public.sizes SET admin_id = v_admin_id WHERE admin_id IS NULL;
    UPDATE public.customer_types SET admin_id = v_admin_id WHERE admin_id IS NULL;
    UPDATE public.goods_damaged_entries SET admin_id = v_admin_id WHERE admin_id IS NULL;
    UPDATE public.app_settings SET admin_id = v_admin_id WHERE admin_id IS NULL;
  END IF;
END $$;

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_admin_id ON public.profiles(admin_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_shops_admin_id ON public.shops(admin_id);
CREATE INDEX IF NOT EXISTS idx_categories_admin_id ON public.categories(admin_id);
CREATE INDEX IF NOT EXISTS idx_sizes_admin_id ON public.sizes(admin_id);
CREATE INDEX IF NOT EXISTS idx_customer_types_admin_id ON public.customer_types(admin_id);
CREATE INDEX IF NOT EXISTS idx_gd_entries_admin_id ON public.goods_damaged_entries(admin_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_admin_id ON public.app_settings(admin_id);

-- 5. NEW SECURITY DEFINER FUNCTIONS

-- Get user's effective admin_id (admin=self, sub-users=their admin, super_admin=NULL)
CREATE OR REPLACE FUNCTION public.get_user_admin_id_secure(user_uuid uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN role = 'admin' THEN id 
    WHEN role = 'super_admin' THEN NULL
    ELSE admin_id 
  END
  FROM public.profiles 
  WHERE id = user_uuid AND deleted_at IS NULL;
$$;

-- Check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_uuid AND role = 'super_admin' AND deleted_at IS NULL
  );
$$;

-- Check if user is effectively active (considers admin's status too)
CREATE OR REPLACE FUNCTION public.is_user_active(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  SELECT role, status, admin_id INTO rec
  FROM public.profiles WHERE id = user_uuid AND deleted_at IS NULL;
  
  IF NOT FOUND THEN RETURN false; END IF;
  IF rec.role = 'super_admin' THEN RETURN true; END IF;
  IF rec.status != 'active' THEN RETURN false; END IF;
  
  IF rec.role != 'admin' AND rec.admin_id IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = rec.admin_id AND status = 'active' AND deleted_at IS NULL
    );
  END IF;
  
  RETURN true;
END;
$$;

-- Count admin's current shops
CREATE OR REPLACE FUNCTION public.count_admin_shops(admin_uuid uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.shops 
  WHERE admin_id = admin_uuid AND deleted_at IS NULL;
$$;

-- Count admin's current sub-users
CREATE OR REPLACE FUNCTION public.count_admin_users(admin_uuid uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.profiles 
  WHERE admin_id = admin_uuid AND id != admin_uuid AND deleted_at IS NULL;
$$;

-- Helper to promote a user to super admin (run once via SQL editor)
CREATE OR REPLACE FUNCTION public.setup_super_admin(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles 
  SET role = 'super_admin', status = 'active', admin_id = NULL,
      max_shops = NULL, max_users = NULL
  WHERE email = user_email OR user_id = user_email;
END;
$$;

-- 6. DROP ALL EXISTING RLS POLICIES

-- profiles
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_manager_shop" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- shops
DROP POLICY IF EXISTS "Admins can manage shops" ON public.shops;
DROP POLICY IF EXISTS "Admins can view all shops including deleted" ON public.shops;
DROP POLICY IF EXISTS "Authenticated users can view active shops" ON public.shops;

-- categories
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can view all categories including deleted" ON public.categories;
DROP POLICY IF EXISTS "Users can view active categories" ON public.categories;

-- sizes
DROP POLICY IF EXISTS "Admins can manage sizes" ON public.sizes;
DROP POLICY IF EXISTS "Admins can view all sizes including deleted" ON public.sizes;
DROP POLICY IF EXISTS "Users can view active sizes" ON public.sizes;

-- customer_types
DROP POLICY IF EXISTS "Admins can manage customer types" ON public.customer_types;
DROP POLICY IF EXISTS "Admins can view all customer types including deleted" ON public.customer_types;
DROP POLICY IF EXISTS "Users can view active customer types" ON public.customer_types;

-- goods_damaged_entries
DROP POLICY IF EXISTS "Admins can do everything" ON public.goods_damaged_entries;
DROP POLICY IF EXISTS "Admins can manage all entries" ON public.goods_damaged_entries;
DROP POLICY IF EXISTS "Admins can view all entries" ON public.goods_damaged_entries;
DROP POLICY IF EXISTS "Managers can insert for their shop" ON public.goods_damaged_entries;
DROP POLICY IF EXISTS "Managers can update their shop data" ON public.goods_damaged_entries;
DROP POLICY IF EXISTS "Managers can view their shop data" ON public.goods_damaged_entries;
DROP POLICY IF EXISTS "Users can create entries for their shop" ON public.goods_damaged_entries;
DROP POLICY IF EXISTS "Users cannot view entries" ON public.goods_damaged_entries;

-- gd_entry_images
DROP POLICY IF EXISTS "Admins can manage all entry images" ON public.gd_entry_images;
DROP POLICY IF EXISTS "Managers can view images for their shop entries" ON public.gd_entry_images;
DROP POLICY IF EXISTS "Users can insert images for their shop entries" ON public.gd_entry_images;
DROP POLICY IF EXISTS "Users can view images for their entries" ON public.gd_entry_images;

-- app_settings
DROP POLICY IF EXISTS "Admins can manage app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_select_admin" ON public.app_settings;

-- 7. CREATE NEW TENANT-ISOLATED RLS POLICIES (PERMISSIVE = OR logic)

-- ===== PROFILES =====
CREATE POLICY "sa_profiles_all" ON public.profiles FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_select_tenant" ON public.profiles FOR SELECT
  USING (get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid());

CREATE POLICY "profiles_select_manager" ON public.profiles FOR SELECT
  USING (
    get_user_role_secure(auth.uid()) = 'manager'
    AND admin_id = get_user_admin_id_secure(auth.uid())
    AND shop_id = get_user_shop_id_secure(auth.uid())
  );

CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_insert_tenant" ON public.profiles FOR INSERT
  WITH CHECK (get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid());

CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_tenant" ON public.profiles FOR UPDATE
  USING (get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid())
  WITH CHECK (get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid());

CREATE POLICY "profiles_delete_tenant" ON public.profiles FOR DELETE
  USING (get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid() AND id != auth.uid());

-- ===== SHOPS =====
CREATE POLICY "sa_shops_all" ON public.shops FOR ALL
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "shops_all_tenant" ON public.shops FOR ALL
  USING (get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid())
  WITH CHECK (get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid());

CREATE POLICY "shops_select_tenant_users" ON public.shops FOR SELECT
  USING (admin_id = get_user_admin_id_secure(auth.uid()) AND deleted_at IS NULL);

-- ===== CATEGORIES =====
CREATE POLICY "sa_categories_all" ON public.categories FOR ALL
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "categories_all_tenant" ON public.categories FOR ALL
  USING (get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid())
  WITH CHECK (get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid());

CREATE POLICY "categories_select_tenant_users" ON public.categories FOR SELECT
  USING (admin_id = get_user_admin_id_secure(auth.uid()) AND deleted_at IS NULL);

-- ===== SIZES =====
CREATE POLICY "sa_sizes_all" ON public.sizes FOR ALL
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "sizes_all_tenant" ON public.sizes FOR ALL
  USING (get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid())
  WITH CHECK (get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid());

CREATE POLICY "sizes_select_tenant_users" ON public.sizes FOR SELECT
  USING (admin_id = get_user_admin_id_secure(auth.uid()) AND deleted_at IS NULL);

-- ===== CUSTOMER TYPES =====
CREATE POLICY "sa_customer_types_all" ON public.customer_types FOR ALL
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "ct_all_tenant" ON public.customer_types FOR ALL
  USING (get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid())
  WITH CHECK (get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid());

CREATE POLICY "ct_select_tenant_users" ON public.customer_types FOR SELECT
  USING (admin_id = get_user_admin_id_secure(auth.uid()) AND deleted_at IS NULL);

-- ===== GOODS DAMAGED ENTRIES =====
CREATE POLICY "sa_gd_entries_all" ON public.goods_damaged_entries FOR ALL
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "gd_entries_all_tenant" ON public.goods_damaged_entries FOR ALL
  USING (get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid())
  WITH CHECK (get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid());

CREATE POLICY "gd_entries_select_manager" ON public.goods_damaged_entries FOR SELECT
  USING (
    get_user_role_secure(auth.uid()) = 'manager'
    AND admin_id = get_user_admin_id_secure(auth.uid())
    AND shop_id = get_user_shop_id_secure(auth.uid())
  );

CREATE POLICY "gd_entries_insert_manager" ON public.goods_damaged_entries FOR INSERT
  WITH CHECK (
    get_user_role_secure(auth.uid()) = 'manager'
    AND admin_id = get_user_admin_id_secure(auth.uid())
    AND shop_id = get_user_shop_id_secure(auth.uid())
  );

CREATE POLICY "gd_entries_update_manager" ON public.goods_damaged_entries FOR UPDATE
  USING (
    get_user_role_secure(auth.uid()) = 'manager'
    AND admin_id = get_user_admin_id_secure(auth.uid())
    AND shop_id = get_user_shop_id_secure(auth.uid())
  );

CREATE POLICY "gd_entries_insert_user" ON public.goods_damaged_entries FOR INSERT
  WITH CHECK (
    get_user_role_secure(auth.uid()) = 'user'
    AND admin_id = get_user_admin_id_secure(auth.uid())
    AND employee_id = auth.uid()
    AND shop_id = get_user_shop_id_secure(auth.uid())
  );

-- ===== GD ENTRY IMAGES =====
CREATE POLICY "sa_gd_images_all" ON public.gd_entry_images FOR ALL
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "gd_images_all_admin" ON public.gd_entry_images FOR ALL
  USING (
    get_user_role_secure(auth.uid()) = 'admin'
    AND EXISTS (SELECT 1 FROM public.goods_damaged_entries gde WHERE gde.id = gd_entry_images.gd_entry_id AND gde.admin_id = auth.uid())
  )
  WITH CHECK (
    get_user_role_secure(auth.uid()) = 'admin'
    AND EXISTS (SELECT 1 FROM public.goods_damaged_entries gde WHERE gde.id = gd_entry_images.gd_entry_id AND gde.admin_id = auth.uid())
  );

CREATE POLICY "gd_images_select_manager" ON public.gd_entry_images FOR SELECT
  USING (
    get_user_role_secure(auth.uid()) = 'manager'
    AND EXISTS (
      SELECT 1 FROM public.goods_damaged_entries gde
      WHERE gde.id = gd_entry_images.gd_entry_id
      AND gde.admin_id = get_user_admin_id_secure(auth.uid())
      AND gde.shop_id = get_user_shop_id_secure(auth.uid())
    )
  );

CREATE POLICY "gd_images_insert_user" ON public.gd_entry_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.goods_damaged_entries gde
      WHERE gde.id = gd_entry_images.gd_entry_id
      AND gde.employee_id = auth.uid()
      AND gde.admin_id = get_user_admin_id_secure(auth.uid())
    )
  );

CREATE POLICY "gd_images_select_own" ON public.gd_entry_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.goods_damaged_entries gde
      WHERE gde.id = gd_entry_images.gd_entry_id AND gde.employee_id = auth.uid()
    )
  );

-- ===== APP SETTINGS =====
CREATE POLICY "sa_app_settings_all" ON public.app_settings FOR ALL
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "app_settings_all_tenant" ON public.app_settings FOR ALL
  USING (get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid())
  WITH CHECK (get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid());

-- 8. UPDATE handle_new_user TRIGGER FOR SAAS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_id uuid;
  _role text;
  _status text;
  _shop_id uuid;
BEGIN
  _admin_id := (NEW.raw_user_meta_data->>'admin_id')::uuid;
  _role := COALESCE(NEW.raw_user_meta_data->>'role', 'admin');
  _shop_id := (NEW.raw_user_meta_data->>'shop_id')::uuid;
  
  -- Public signup (no admin_id in metadata) = new tenant admin, starts PAUSED
  IF _admin_id IS NULL THEN
    _role := 'admin';
    _status := 'paused';
    _admin_id := NEW.id;
  ELSE
    -- Sub-user created by admin, starts active
    _status := 'active';
  END IF;
  
  INSERT INTO public.profiles (id, name, user_id, role, admin_id, status, shop_id, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'user_id', NEW.email),
    _role,
    _admin_id,
    _status,
    _shop_id,
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(NEW.raw_user_meta_data->>'name', profiles.name),
    user_id = COALESCE(NEW.raw_user_meta_data->>'user_id', NEW.email),
    email = NEW.email,
    deleted_at = NULL,
    updated_at = now();
  RETURN NEW;
END;
$$;
