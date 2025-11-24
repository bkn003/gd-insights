-- Create customer_types table
CREATE TABLE public.customer_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Add customer_type_id to goods_damaged_entries
ALTER TABLE public.goods_damaged_entries 
ADD COLUMN customer_type_id UUID REFERENCES public.customer_types(id);

-- Enable RLS on customer_types
ALTER TABLE public.customer_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_types
CREATE POLICY "Users can view active customer types"
  ON public.customer_types
  FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY "Admins can view all customer types including deleted"
  ON public.customer_types
  FOR SELECT
  USING (get_current_user_role() = 'admin');

CREATE POLICY "Admins can manage customer types"
  ON public.customer_types
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_customer_types_updated_at
  BEFORE UPDATE ON public.customer_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();