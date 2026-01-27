-- Add WhatsApp group link to shops table
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS whatsapp_group_link TEXT;

-- Create app_settings table for global toggles
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for app_settings
CREATE POLICY "Anyone can view app_settings" 
ON public.app_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage app_settings" 
ON public.app_settings 
FOR ALL 
USING (get_current_user_role() = 'admin');

-- Insert default setting for WhatsApp redirect
INSERT INTO public.app_settings (key, value) 
VALUES ('whatsapp_redirect_enabled', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();