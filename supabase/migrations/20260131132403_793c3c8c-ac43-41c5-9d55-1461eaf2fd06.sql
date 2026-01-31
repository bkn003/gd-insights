-- Fix function search path for handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- Fix function search path for prevent_user_hard_delete
CREATE OR REPLACE FUNCTION public.prevent_user_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
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
$function$;