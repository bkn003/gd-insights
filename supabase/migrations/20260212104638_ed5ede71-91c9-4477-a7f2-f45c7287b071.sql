
-- Custom field definitions (e.g., "Color", "Brand")
CREATE TABLE public.custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Custom field options (e.g., "Red", "Blue" for "Color")
CREATE TABLE public.custom_field_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_field_id UUID NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- GD entry custom field values (linking entries to selected options)
CREATE TABLE public.gd_entry_custom_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gd_entry_id UUID NOT NULL REFERENCES public.goods_damaged_entries(id) ON DELETE CASCADE,
  custom_field_id UUID NOT NULL REFERENCES public.custom_fields(id),
  custom_field_option_id UUID NOT NULL REFERENCES public.custom_field_options(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gd_entry_custom_values ENABLE ROW LEVEL SECURITY;

-- RLS for custom_fields
CREATE POLICY "cf_all_admin" ON public.custom_fields FOR ALL
  USING (get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid())
  WITH CHECK (get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid());

CREATE POLICY "cf_select_tenant_users" ON public.custom_fields FOR SELECT
  USING (admin_id = get_user_admin_id_secure(auth.uid()) AND deleted_at IS NULL);

CREATE POLICY "sa_cf_all" ON public.custom_fields FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- RLS for custom_field_options
CREATE POLICY "cfo_all_admin" ON public.custom_field_options FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.custom_fields cf 
    WHERE cf.id = custom_field_options.custom_field_id 
    AND cf.admin_id = auth.uid()
    AND get_user_role_secure(auth.uid()) = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.custom_fields cf 
    WHERE cf.id = custom_field_options.custom_field_id 
    AND cf.admin_id = auth.uid()
    AND get_user_role_secure(auth.uid()) = 'admin'
  ));

CREATE POLICY "cfo_select_tenant_users" ON public.custom_field_options FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.custom_fields cf 
    WHERE cf.id = custom_field_options.custom_field_id 
    AND cf.admin_id = get_user_admin_id_secure(auth.uid())
    AND cf.deleted_at IS NULL
  ) AND deleted_at IS NULL);

CREATE POLICY "sa_cfo_all" ON public.custom_field_options FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- RLS for gd_entry_custom_values
CREATE POLICY "gecv_all_admin" ON public.gd_entry_custom_values FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.goods_damaged_entries gde 
    WHERE gde.id = gd_entry_custom_values.gd_entry_id 
    AND gde.admin_id = auth.uid()
    AND get_user_role_secure(auth.uid()) = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.goods_damaged_entries gde 
    WHERE gde.id = gd_entry_custom_values.gd_entry_id 
    AND gde.admin_id = auth.uid()
    AND get_user_role_secure(auth.uid()) = 'admin'
  ));

CREATE POLICY "gecv_insert_user" ON public.gd_entry_custom_values FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.goods_damaged_entries gde 
    WHERE gde.id = gd_entry_custom_values.gd_entry_id 
    AND gde.employee_id = auth.uid()
    AND gde.admin_id = get_user_admin_id_secure(auth.uid())
  ));

CREATE POLICY "gecv_select_tenant" ON public.gd_entry_custom_values FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.goods_damaged_entries gde 
    WHERE gde.id = gd_entry_custom_values.gd_entry_id 
    AND gde.admin_id = get_user_admin_id_secure(auth.uid())
  ));

CREATE POLICY "sa_gecv_all" ON public.gd_entry_custom_values FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_custom_fields_updated_at
  BEFORE UPDATE ON public.custom_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custom_field_options_updated_at
  BEFORE UPDATE ON public.custom_field_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
