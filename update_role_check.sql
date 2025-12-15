-- SQL to add 'manager' role to the profiles table check constraint
-- Run this in the Supabase SQL Editor

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'user', 'manager'));
