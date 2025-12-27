import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoodsEntry {
  id: string;
  created_at: string;
  shop_id: string;
  category_id: string;
  size_id: string;
  employee_name: string;
  notes: string;
  shops: { name: string };
  categories: { name: string };
  sizes: { size: string };
  gd_entry_images: Array<{
    id: string;
    image_url: string;
    image_name?: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Fetch entries with related data
    const { data: entriesData, error: entriesError } = await supabase
      .from('goods_damaged_entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (entriesError) throw entriesError;

    // Fetch images
    const { data: imagesData, error: imagesError } = await supabase
      .from('gd_entry_images')
      .select('*');

    if (imagesError) throw imagesError;

    // Fetch related data
    const [shopsRes, categoriesRes, sizesRes] = await Promise.all([
      supabase.from('shops').select('*'),
      supabase.from('categories').select('*'),
      supabase.from('sizes').select('*'),
    ]);

    if (shopsRes.error || categoriesRes.error || sizesRes.error) {
      throw new Error('Failed to fetch related data');
    }

    // Enrich entries with related data and images
    const enrichedEntries: GoodsEntry[] = entriesData.map(entry => {
      const shop = shopsRes.data.find(s => s.id === entry.shop_id);
      const category = categoriesRes.data.find(c => c.id === entry.category_id);
      const size = sizesRes.data.find(s => s.id === entry.size_id);
      const entryImages = imagesData.filter(img => img.gd_entry_id === entry.id);

      return {
        ...entry,
        shops: { name: shop?.name || 'Unknown Shop' },
        categories: { name: category?.name || 'Unknown Category' },
        sizes: { size: size?.size || 'Unknown Size' },
        gd_entry_images: entryImages
      };
    });

    // Generate CSV data instead of Excel (simpler and more reliable)
    const csvHeaders = ['Date', 'Shop', 'Category', 'Size', 'Reporter', 'Notes', 'Image URLs'];
    const csvRows = enrichedEntries.map(entry => [
      new Date(entry.created_at).toLocaleString(),
      entry.shops.name,
      entry.categories.name,
      entry.sizes.size,
      entry.employee_name || 'Unknown',
      entry.notes || '',
      entry.gd_entry_images.map(img => img.image_url).join('; ')
    ]);

    // Escape CSV fields
    const escapeCSV = (field: string) => {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    console.log(`CSV file generated successfully, ${enrichedEntries.length} entries`);

    // Return CSV file
    return new Response(csvContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="gd_report.csv"',
      },
    });

  } catch (error) {
    console.error('Export error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
