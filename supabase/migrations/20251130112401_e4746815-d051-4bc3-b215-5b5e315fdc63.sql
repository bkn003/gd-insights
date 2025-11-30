-- Enable real-time updates for goods_damaged_entries table
-- This allows the dashboard to receive live updates when new GD entries are added

-- Set REPLICA IDENTITY to FULL to capture complete row data during updates
ALTER TABLE public.goods_damaged_entries REPLICA IDENTITY FULL;

-- Add the table to the supabase_realtime publication to activate real-time functionality
ALTER PUBLICATION supabase_realtime ADD TABLE public.goods_damaged_entries;