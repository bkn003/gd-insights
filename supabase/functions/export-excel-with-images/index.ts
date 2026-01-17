import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import ExcelJS from 'npm:exceljs@4.4.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EntryImage {
  id: string;
  image_url: string;
  image_name?: string;
}

interface GoodsEntry {
  id: string;
  created_at: string;
  shop_id: string;
  category_id: string;
  size_id: string;
  employee_name: string;
  notes: string;
  customer_type_id?: string;
  shops: { name: string };
  categories: { name: string };
  sizes: { size: string };
  customer_types?: { name: string };
  gd_entry_images: EntryImage[];
}

// Fetch image as base64
async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; extension: 'jpeg' | 'png' | 'gif' } | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    // Determine extension from content type
    const contentType = response.headers.get('content-type') || '';
    let extension: 'jpeg' | 'png' | 'gif' = 'jpeg';
    if (contentType.includes('png')) extension = 'png';
    else if (contentType.includes('gif')) extension = 'gif';
    
    return { base64, extension };
  } catch (error) {
    console.error('Error fetching image:', imageUrl, error);
    return null;
  }
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

    // Parse request body for entries
    const body = await req.json().catch(() => ({}));
    const providedEntries = body.entries as GoodsEntry[] | undefined;

    let enrichedEntries: GoodsEntry[];

    if (providedEntries && providedEntries.length > 0) {
      // Use provided entries
      enrichedEntries = providedEntries;
      console.log(`Using ${providedEntries.length} provided entries`);
    } else {
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
      const [shopsRes, categoriesRes, sizesRes, customerTypesRes] = await Promise.all([
        supabase.from('shops').select('*'),
        supabase.from('categories').select('*'),
        supabase.from('sizes').select('*'),
        supabase.from('customer_types').select('*'),
      ]);

      if (shopsRes.error || categoriesRes.error || sizesRes.error) {
        throw new Error('Failed to fetch related data');
      }

      // Enrich entries with related data and images
      enrichedEntries = entriesData.map(entry => {
        const shop = shopsRes.data.find(s => s.id === entry.shop_id);
        const category = categoriesRes.data.find(c => c.id === entry.category_id);
        const size = sizesRes.data.find(s => s.id === entry.size_id);
        const customerType = customerTypesRes.data?.find(ct => ct.id === entry.customer_type_id);
        const entryImages = imagesData.filter(img => img.gd_entry_id === entry.id);

        return {
          ...entry,
          shops: { name: shop?.name || 'Unknown Shop' },
          categories: { name: category?.name || 'Unknown Category' },
          sizes: { size: size?.size || 'Unknown Size' },
          customer_types: customerType ? { name: customerType.name } : undefined,
          gd_entry_images: entryImages
        };
      });
    }

    console.log(`Processing ${enrichedEntries.length} entries for Excel export`);

    // Create Excel workbook with ExcelJS
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GD Tracker App';
    workbook.created = new Date();

    // Create main worksheet
    const worksheet = workbook.addWorksheet('GD Report', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    // Define columns with proper widths
    worksheet.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Date & Time', key: 'date', width: 20 },
      { header: 'Shop', key: 'shop', width: 18 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Size', key: 'size', width: 12 },
      { header: 'Customer Type', key: 'customerType', width: 18 },
      { header: 'Reporter', key: 'reporter', width: 18 },
      { header: 'Notes', key: 'notes', width: 35 },
      { header: 'Image 1', key: 'image1', width: 18 },
      { header: 'Image 2', key: 'image2', width: 18 },
      { header: 'Image 3', key: 'image3', width: 18 },
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF7C3AED' } // Purple color
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // Process entries and add images
    let rowIndex = 2;
    for (let i = 0; i < enrichedEntries.length; i++) {
      const entry = enrichedEntries[i];
      
      // Format date
      const date = new Date(entry.created_at);
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear().toString().slice(-2)} ${date.getHours() % 12 || 12}:${date.getMinutes().toString().padStart(2, '0')} ${date.getHours() >= 12 ? 'PM' : 'AM'}`;

      // Add row data
      const row = worksheet.addRow({
        sno: i + 1,
        date: formattedDate,
        shop: entry.shops?.name || 'Unknown',
        category: entry.categories?.name || 'Unknown',
        size: entry.sizes?.size || 'Unknown',
        customerType: entry.customer_types?.name || 'N/A',
        reporter: entry.employee_name || 'Unknown',
        notes: entry.notes || '',
        image1: '',
        image2: '',
        image3: ''
      });

      // Set row height for images
      row.height = 80;
      row.alignment = { vertical: 'middle', wrapText: true };

      // Add images (up to 3 per entry)
      const images = entry.gd_entry_images?.slice(0, 3) || [];
      
      for (let imgIndex = 0; imgIndex < images.length; imgIndex++) {
        const img = images[imgIndex];
        try {
          const imageData = await fetchImageAsBase64(img.image_url);
          
          if (imageData) {
            const imageId = workbook.addImage({
              base64: imageData.base64,
              extension: imageData.extension,
            });

            // Calculate column index (8, 9, 10 for Image 1, 2, 3)
            const colIndex = 8 + imgIndex;

            worksheet.addImage(imageId, {
              tl: { col: colIndex, row: rowIndex - 1 },
              ext: { width: 100, height: 75 }
            });
          }
        } catch (imgError) {
          console.error(`Error adding image ${imgIndex} for entry ${entry.id}:`, imgError);
        }
      }

      rowIndex++;
    }

    // Add alternating row colors for better readability
    for (let i = 2; i <= rowIndex; i++) {
      const row = worksheet.getRow(i);
      if (i % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF3F4F6' }
        };
      }
    }

    // Add borders to all cells
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
      });
    });

    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer();

    console.log(`Excel file generated successfully with ${enrichedEntries.length} entries`);

    // Return Excel file
    return new Response(buffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="gd_report_${new Date().toISOString().split('T')[0]}.xlsx"`,
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
