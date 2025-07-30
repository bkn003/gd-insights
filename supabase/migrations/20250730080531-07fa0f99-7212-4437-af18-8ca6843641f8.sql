
-- Update the handle_new_user function to avoid conflicts with existing users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Update RLS policies to properly handle soft-deleted users
-- This ensures that when a user is soft-deleted, their GD entries remain accessible to admins
-- but the user profile is treated as deleted
DROP POLICY IF EXISTS "Users can view active profiles" ON profiles;
CREATE POLICY "Users can view active profiles" 
ON profiles FOR SELECT 
USING (deleted_at IS NULL OR id = auth.uid());

-- Ensure GD entries remain accessible even when user is soft-deleted
DROP POLICY IF EXISTS "Admins can view all entries" ON goods_damaged_entries;
CREATE POLICY "Admins can view all entries" 
ON goods_damaged_entries FOR SELECT 
USING (get_current_user_role() = 'admin'::text);

-- Create a trigger to prevent hard deletion of users who have GD entries
CREATE OR REPLACE FUNCTION prevent_user_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
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

-- Create the trigger
DROP TRIGGER IF EXISTS prevent_user_hard_delete_trigger ON profiles;
CREATE TRIGGER prevent_user_hard_delete_trigger
  BEFORE DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_user_hard_delete();
