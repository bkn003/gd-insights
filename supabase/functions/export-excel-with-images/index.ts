
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as ExcelJS from 'https://cdn.skypack.dev/exceljs@4.4.0';

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

    // Create Excel workbook with embedded images
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Goods Damage Report');

    // Define columns with proper width for images
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Shop', key: 'shop', width: 25 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Size', key: 'size', width: 15 },
      { header: 'Reporter', key: 'reporter', width: 20 },
      { header: 'Notes', key: 'notes', width: 30 },
      { header: 'Images', key: 'images', width: 50 }
    ];

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6E6FA' }
    };

    let rowIndex = 2; // Start after header

    for (const entry of enrichedEntries) {
      // Add data row
      const row = worksheet.addRow({
        date: new Date(entry.created_at).toLocaleString(),
        shop: entry.shops.name,
        category: entry.categories.name,
        size: entry.sizes.size,
        reporter: entry.employee_name || 'Unknown',
        notes: entry.notes || '',
        images: entry.gd_entry_images.length > 0 ? `${entry.gd_entry_images.length} image(s)` : 'No images'
      });

      // Set row height to accommodate images
      row.height = entry.gd_entry_images.length > 0 ? 80 : 20;

      // Embed images if they exist
      if (entry.gd_entry_images.length > 0) {
        // Clear the text from images column first
        worksheet.getCell(`G${rowIndex}`).value = '';
        
        for (let i = 0; i < Math.min(entry.gd_entry_images.length, 3); i++) {
          const imageData = entry.gd_entry_images[i];
          try {
            // Fetch image from Supabase storage
            const imageResponse = await fetch(imageData.image_url);
            if (imageResponse.ok) {
              const imageBuffer = await imageResponse.arrayBuffer();
              
              // Determine image type from URL or content-type
              let extension = 'jpeg';
              const contentType = imageResponse.headers.get('content-type');
              if (contentType) {
                if (contentType.includes('png')) extension = 'png';
                else if (contentType.includes('gif')) extension = 'gif';
                else if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpeg';
              } else if (imageData.image_url.toLowerCase().includes('.png')) {
                extension = 'png';
              }
              
              // Add image to workbook
              const imageId = workbook.addImage({
                buffer: imageBuffer,
                extension: extension,
              });

              // Position images within the Images column with proper coordinates
              worksheet.addImage(imageId, {
                tl: { col: 6 + (i * 0.33), row: rowIndex - 1 }, // Top-left 
                ext: { width: 100, height: 75 }, // Fixed size
                editAs: 'absolute'
              });
            }
          } catch (imageError) {
            console.error('Error processing image:', imageError);
          }
        }
      }

      rowIndex++;
    }

    // Auto-fit columns (except images column which we set manually)
    worksheet.columns.forEach((column, index) => {
      if (index < 6) { // Don't auto-fit the images column
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
      }
    });

    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const uint8Array = new Uint8Array(buffer);

    // Return Excel file
    return new Response(uint8Array, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="gd_report_with_embedded_images.xlsx"',
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
