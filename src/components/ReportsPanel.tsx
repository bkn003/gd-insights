import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ImageDisplay } from '@/components/ImageDisplay';
import { toast } from 'sonner';
import { Download, Filter, Calendar as CalendarIcon, FileText, Image, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { Database } from '@/types/database';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type GoodsEntry = Database['public']['Tables']['goods_damaged_entries']['Row'] & {
  categories: { name: string };
  sizes: { size: string };
  shops: { name: string };
  customer_types?: { name: string };
  gd_entry_images: Array<{
    id: string;
    image_url: string;
    image_name?: string;
  }>;
};

type Shop = Database['public']['Tables']['shops']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type Size = Database['public']['Tables']['sizes']['Row'];
type CustomerType = Database['public']['Tables']['customer_types']['Row'];

export const ReportsPanel = memo(() => {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<GoodsEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<GoodsEntry[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([]);
  
  // Filter states - default to "today"
  const [selectedShop, setSelectedShop] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSize, setSelectedSize] = useState<string>('all');
  const [selectedCustomerType, setSelectedCustomerType] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [customDateFrom, setCustomDateFrom] = useState<Date>();
  const [customDateTo, setCustomDateTo] = useState<Date>();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [entries, selectedShop, selectedCategory, selectedSize, selectedCustomerType, dateFilter, customDateFrom, customDateTo]);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('Starting to fetch data...');
      
      // Fetch entries with images
      const { data: entriesData, error: entriesError } = await supabase
        .from('goods_damaged_entries')
        .select('*')
        .order('created_at', { ascending: false });

      if (entriesError) {
        console.error('Error fetching entries:', entriesError);
        throw entriesError;
      }

      console.log('Fetched entries:', entriesData);

      // Fetch images for all entries
      const { data: imagesData, error: imagesError } = await supabase
        .from('gd_entry_images')
        .select('*')
        .order('created_at', { ascending: true });

      if (imagesError) {
        console.error('Error fetching images:', imagesError);
        throw imagesError;
      }

      console.log('Fetched images:', imagesData);

      // Fetch related data separately
      const [shopsRes, categoriesRes, sizesRes, customerTypesRes] = await Promise.all([
        supabase.from('shops').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('sizes').select('*').order('size'),
        supabase.from('customer_types').select('*').is('deleted_at', null).order('name'),
      ]);

      if (shopsRes.error) {
        console.error('Error fetching shops:', shopsRes.error);
        throw shopsRes.error;
      }
      if (categoriesRes.error) {
        console.error('Error fetching categories:', categoriesRes.error);
        throw categoriesRes.error;
      }
      if (sizesRes.error) {
        console.error('Error fetching sizes:', sizesRes.error);
        throw sizesRes.error;
      }
      if (customerTypesRes.error) {
        console.error('Error fetching customer types:', customerTypesRes.error);
        throw customerTypesRes.error;
      }

      // Manually join the data including images
      const enrichedEntries = entriesData.map(entry => {
        const shop = shopsRes.data.find(s => s.id === entry.shop_id);
        const category = categoriesRes.data.find(c => c.id === entry.category_id);
        const size = sizesRes.data.find(s => s.id === entry.size_id);
        const customerType = customerTypesRes.data.find(ct => ct.id === entry.customer_type_id);
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

      console.log('Enriched entries with images:', enrichedEntries);

      setEntries(enrichedEntries);
      setShops(shopsRes.data);
      setCategories(categoriesRes.data);
      setSizes(sizesRes.data);
      setCustomerTypes(customerTypesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load reports data');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...entries];

    // Shop filter
    if (selectedShop !== 'all') {
      filtered = filtered.filter(entry => entry.shop_id === selectedShop);
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(entry => entry.category_id === selectedCategory);
    }

    // Size filter
    if (selectedSize !== 'all') {
      filtered = filtered.filter(entry => entry.size_id === selectedSize);
    }

    // Customer type filter
    if (selectedCustomerType !== 'all') {
      filtered = filtered.filter(entry => entry.customer_type_id === selectedCustomerType);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (dateFilter) {
        case 'today':
          filtered = filtered.filter(entry => {
            const entryDate = new Date(entry.created_at);
            return entryDate >= today;
          });
          break;
        case 'yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          filtered = filtered.filter(entry => {
            const entryDate = new Date(entry.created_at);
            return entryDate >= yesterday && entryDate < today;
          });
          break;
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          filtered = filtered.filter(entry => {
            const entryDate = new Date(entry.created_at);
            return entryDate >= weekAgo;
          });
          break;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          filtered = filtered.filter(entry => {
            const entryDate = new Date(entry.created_at);
            return entryDate >= monthAgo;
          });
          break;
        case 'year':
          const yearAgo = new Date(today);
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          filtered = filtered.filter(entry => {
            const entryDate = new Date(entry.created_at);
            return entryDate >= yearAgo;
          });
          break;
        case 'custom':
          if (customDateFrom && customDateTo) {
            filtered = filtered.filter(entry => {
              const entryDate = new Date(entry.created_at);
              return entryDate >= customDateFrom && entryDate <= customDateTo;
            });
          }
          break;
      }
    }

    setFilteredEntries(filtered);
  };

  // Compute summary statistics
  const summary = useMemo(() => {
    if (!filteredEntries || filteredEntries.length === 0) {
      return null;
    }

    const byShop: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const bySize: Record<string, number> = {};
    const byCustomerType: Record<string, number> = {};
    const byNotes: Record<string, number> = {};
    let firstDate = filteredEntries[0].created_at;
    let lastDate = filteredEntries[0].created_at;

    filteredEntries.forEach((report) => {
      // Count by shop
      const shopName = report.shops?.name || 'Unknown';
      byShop[shopName] = (byShop[shopName] || 0) + 1;

      // Count by category
      const categoryName = report.categories?.name || 'Unknown';
      byCategory[categoryName] = (byCategory[categoryName] || 0) + 1;

      // Count by size
      const sizeName = report.sizes?.size || 'Unknown';
      bySize[sizeName] = (bySize[sizeName] || 0) + 1;

      // Count by customer type
      const customerType = report.customer_types?.name || 'Unknown';
      byCustomerType[customerType] = (byCustomerType[customerType] || 0) + 1;

      // Count by notes (first 50 characters as grouping key)
      const noteKey = report.notes ? report.notes.substring(0, 50).trim() : 'No notes';
      byNotes[noteKey] = (byNotes[noteKey] || 0) + 1;

      // Track date range
      if (report.created_at < firstDate) firstDate = report.created_at;
      if (report.created_at > lastDate) lastDate = report.created_at;
    });

    return {
      totalEntries: filteredEntries.length,
      byShop,
      byCategory,
      bySize,
      byCustomerType,
      byNotes,
      firstDate: new Date(firstDate).toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      }),
      lastDate: new Date(lastDate).toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
    };
  }, [filteredEntries]);

  const formatTime12Hour = (date: Date) => {
    return format(date, 'yyyy-MM-dd hh:mm a');
  };

  // Helper function to fetch image as base64
  const fetchImageAsBase64 = async (imageUrl: string): Promise<string | null> => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error fetching image:', error);
      return null;
    }
  };

  // Enhanced Excel export with image thumbnails embedded
  const exportExcelMulti = async () => {
    if (filteredEntries.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      toast.info('Preparing Excel export with embedded image thumbnails...');
      
      const wb = XLSX.utils.book_new();

      // Prepare data for export with embedded images
      const exportData = await Promise.all(
        filteredEntries.map(async (entry) => {
          const baseData = {
            Date: formatTime12Hour(new Date(entry.created_at)),
            Shop: entry.shops.name,
            Category: entry.categories.name,
            Size: entry.sizes.size,
            'Customer Type': entry.customer_types?.name || 'Not specified',
            Reporter: entry.employee_name || 'Unknown',
            Notes: entry.notes || '',
          };

          // Process up to 3 images for this entry
          if (entry.gd_entry_images.length > 0) {
            try {
              const imagePromises = entry.gd_entry_images.slice(0, 3).map(async (img, index) => {
                const base64 = await fetchImageAsBase64(img.image_url);
                if (base64) {
                  // Create a small thumbnail representation for Excel
                  return {
                    name: img.image_name || `Image ${index + 1}`,
                    data: base64,
                    url: img.image_url
                  };
                }
                return null;
              });
              
              const imageData = await Promise.all(imagePromises);
              const validImages = imageData.filter(img => img !== null);
              
              if (validImages.length > 0) {
                // Create a cell with image thumbnails data
                const imageInfo = validImages.map(img => `📸 ${img?.name || 'Image'}`).join(' | ');
                return {
                  ...baseData,
                  Images: `${validImages.length} embedded: ${imageInfo}`,
                  ImageThumbnails: validImages // Store for potential embedding
                };
              }
            } catch (error) {
              console.error('Error processing images for entry:', entry.id, error);
            }
          }
          
          return {
            ...baseData,
            Images: 'No images',
            ImageThumbnails: []
          };
        })
      );

      // Create enhanced workbook with image data
      const createWorksheetWithImageThumbnails = (name: string, data: any[]) => {
        // Clean data for export (remove thumbnail data from sheet)
        const cleanData = data.map(({ ImageThumbnails, ...rest }) => rest);
        const ws = XLSX.utils.json_to_sheet(cleanData, { skipHeader: false });
        
        // Enhanced styling for image cells
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
          const imageCell = ws[XLSX.utils.encode_cell({ r: R, c: 6 })]; // Images column (now at index 6)
          if (imageCell && imageCell.v && imageCell.v.includes('embedded')) {
            imageCell.s = {
              fill: { fgColor: { rgb: "E3F2FD" } },
              font: { sz: 10, color: { rgb: "1976D2" } },
              alignment: { wrapText: true, vertical: "center" }
            };
          }
        }
        
        // Auto-width and formatting
        const colWidths = [
          { wch: 18 }, // Date
          { wch: 15 }, // Shop
          { wch: 15 }, // Category
          { wch: 10 }, // Size
          { wch: 15 }, // Customer Type
          { wch: 15 }, // Reporter
          { wch: 40 }, // Images (wider for thumbnail info)
          { wch: 30 }  // Notes
        ];
        ws['!cols'] = colWidths;
        
        // Set row heights for better display
        ws['!rows'] = [{ hpx: 25 }, ...data.map(() => ({ hpx: 45 }))];
        ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
        
        return ws;
      };

      // Create sheets with enhanced image data
      const overallWs = createWorksheetWithImageThumbnails('Overall Report', exportData);
      XLSX.utils.book_append_sheet(wb, overallWs, 'Overall Report');

      // Shop-wise sheets
      const uniqueShops = [...new Set(exportData.map(d => d.Shop).filter(Boolean))].sort();
      for (const shop of uniqueShops) {
        const shopData = exportData.filter(d => d.Shop === shop);
        const sheetName = `Shop - ${shop}`.slice(0, 31);
        const ws = createWorksheetWithImageThumbnails(sheetName, shopData);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      // Category-wise sheets
      const uniqueCategories = [...new Set(exportData.map(d => d.Category).filter(Boolean))].sort();
      for (const category of uniqueCategories) {
        const categoryData = exportData.filter(d => d.Category === category);
        const sheetName = `Category - ${category}`.slice(0, 31);
        const ws = createWorksheetWithImageThumbnails(sheetName, categoryData);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      const fileName = `gd_report_with_images_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
      XLSX.writeFile(wb, fileName, { compression: true });
      
      toast.success(`Excel report exported with embedded image thumbnails! ${filteredEntries.length} entries across multiple sheets`);
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast.error('Failed to export Excel. Please try again.');
    }
  };

  const exportExcelAdvanced = async () => {
    if (filteredEntries.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      toast.info('Generating advanced Excel export with images...');
      
      const { data, error } = await supabase.functions.invoke('export-excel-with-images', {
        body: { 
          entries: filteredEntries.map(entry => ({
            ...entry,
            // Include only necessary data to reduce payload size
            gd_entry_images: entry.gd_entry_images.slice(0, 3)
          }))
        }
      });

      if (error) throw error;

      // Create download link for the CSV file
      const blob = new Blob([data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gd_report_enhanced_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Advanced Excel export completed! Images are referenced by URL.');
    } catch (error) {
      console.error('Error with advanced export:', error);
      toast.error('Failed to generate advanced export. Using fallback method...');
      
      // Fallback to existing Excel export
      exportExcelMulti();
    }
  };

  const exportReportPDF = async () => {
    if (filteredEntries.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      console.log('Starting multi-sheet PDF export...');
      
      // Wait for fonts to be ready
      await (document as any).fonts?.ready;

      // Step 1: Create Excel workbook in memory (same as Excel export)
      const wb = XLSX.utils.book_new();

      // Prepare data for export
      const exportData = filteredEntries.map(entry => ({
        Date: formatTime12Hour(new Date(entry.created_at)),
        Shop: entry.shops.name,
        Category: entry.categories.name,
        Size: entry.sizes.size,
        'Customer Type': entry.customer_types?.name || 'Not specified',
        Reporter: entry.employee_name || 'Unknown',
        Notes: entry.notes || ''
      }));

      // Auto-width columns helper
      const autoWidth = (ws: XLSX.WorkSheet, rows: any[]) => {
        const colWidths: number[] = [];
        rows.forEach(row => {
          Object.values(row).forEach((value, i) => {
            const v = value == null ? '' : String(value);
            colWidths[i] = Math.max(colWidths[i] || 0, v.length);
          });
        });
        ws['!cols'] = colWidths.map(width => ({ wch: Math.min(Math.max(width + 2, 12), 40) }));
      };

      // Create worksheet helper
      const createWorksheet = (name: string, data: any[]) => {
        const ws = XLSX.utils.json_to_sheet(data, { skipHeader: false });
        autoWidth(ws, data);
        ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
        return ws;
      };

      // Overall Report
      const overallWs = createWorksheet('Overall Report', exportData);
      XLSX.utils.book_append_sheet(wb, overallWs, 'Overall Report');

      // Shop-wise sheets
      const uniqueShops = [...new Set(exportData.map(d => d.Shop).filter(Boolean))].sort();
      for (const shop of uniqueShops) {
        const shopData = exportData.filter(d => d.Shop === shop);
        const sheetName = `Shop - ${shop}`.slice(0, 31);
        const ws = createWorksheet(sheetName, shopData);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      // Category-wise sheets
      const uniqueCategories = [...new Set(exportData.map(d => d.Category).filter(Boolean))].sort();
      for (const category of uniqueCategories) {
        const categoryData = exportData.filter(d => d.Category === category);
        const sheetName = `Category - ${category}`.slice(0, 31);
        const ws = createWorksheet(sheetName, categoryData);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      // Step 2: Convert each sheet into PDF
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        putOnlyUsedFonts: true,
        compress: true
      });

      // Set document properties for UTF-8 support
      doc.setProperties({
        title: 'GD Multi-Sheet Report',
        creator: 'GD App'
      });

      wb.SheetNames.forEach((sheetName, idx) => {
        const ws = wb.Sheets[sheetName];
        const sheetData = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (idx > 0) doc.addPage(); // new page for each sheet

        // Add sheet title
        doc.setFontSize(16);
        doc.text(`${sheetName} Report`, 14, 22);

        // Add table for this sheet
        autoTable(doc, {
          head: [sheetData[0] as string[]],
          body: sheetData.slice(1) as string[][],
          startY: 35,
          styles: { 
            fontSize: 9,
            cellPadding: 3,
            overflow: 'linebreak',
            cellWidth: 'wrap',
            halign: 'left',
            valign: 'top',
            fontStyle: 'normal'
          },
          headStyles: { 
            fillColor: [41, 128, 185],
            fontStyle: 'bold',
            textColor: [255, 255, 255],
            halign: 'center'
          },
          columnStyles: {
            0: { cellWidth: 35 },  // Date
            1: { cellWidth: 25 },  // Shop
            2: { cellWidth: 25 },  // Category
            3: { cellWidth: 20 },  // Size
            4: { cellWidth: 25 },  // Customer Type
            5: { cellWidth: 25 },  // Reporter
            6: { cellWidth: 60, fontSize: 8 }  // Notes
          }
        });
      });

      // Step 3: Save final PDF
      const fileName = `gd_report_multisheet_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(fileName);
      
      console.log('Multi-sheet PDF saved successfully');
      toast.success(`PDF report exported successfully! ${filteredEntries.length} entries across ${wb.SheetNames.length} sheets`);
    } catch (error) {
      console.error('Error exporting multi-sheet PDF:', error);
      toast.error('Failed to export PDF. Please try again.');
    }
  };

  const clearFilters = () => {
    setSelectedShop('all');
    setSelectedCategory('all');
    setSelectedSize('all');
    setSelectedCustomerType('all');
    setDateFilter('today');
    setCustomDateFrom(undefined);
    setCustomDateTo(undefined);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading reports...</div>;
  }

  return (
    <div className="space-y-6 w-full min-w-0">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
            Filters & Export
          </CardTitle>
          <CardDescription className="text-sm">
            Filter and export GD reports
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mobile-friendly grid layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="space-y-2 min-w-0">
              <Label className="text-sm font-medium">Shop</Label>
              <Select value={selectedShop} onValueChange={setSelectedShop}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shops</SelectItem>
                  {shops.map(shop => (
                    <SelectItem key={shop.id} value={shop.id}>
                      {shop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 min-w-0">
              <Label className="text-sm font-medium">Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 min-w-0">
              <Label className="text-sm font-medium">Size</Label>
              <Select value={selectedSize} onValueChange={setSelectedSize}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sizes</SelectItem>
                  {sizes.map(size => (
                    <SelectItem key={size.id} value={size.id}>
                      {size.size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 min-w-0">
              <Label className="text-sm font-medium">Customer Type</Label>
              <Select value={selectedCustomerType} onValueChange={setSelectedCustomerType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {customerTypes.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 min-w-0">
              <Label className="text-sm font-medium">Date Range</Label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {dateFilter === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2 min-w-0">
                <Label className="text-sm font-medium">From Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="truncate">
                        {customDateFrom ? format(customDateFrom, 'PPP') : 'Pick a date'}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customDateFrom}
                      onSelect={setCustomDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2 min-w-0">
                <Label className="text-sm font-medium">To Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="truncate">
                        {customDateTo ? format(customDateTo, 'PPP') : 'Pick a date'}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customDateTo}
                      onSelect={setCustomDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button onClick={clearFilters} variant="outline" className="w-full sm:w-auto">
              Clear Filters
            </Button>
            <Button onClick={exportExcelMulti} className="flex items-center justify-center gap-2 w-full sm:w-auto">
              <Download className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Export Excel with Image Info ({filteredEntries.length})</span>
            </Button>
            <Button onClick={exportExcelAdvanced} variant="secondary" className="flex items-center justify-center gap-2 w-full sm:w-auto">
              <Image className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Enhanced Export with Image URLs ({filteredEntries.length})</span>
            </Button>
            <Button onClick={exportReportPDF} variant="outline" className="flex items-center justify-center gap-2 w-full sm:w-auto">
              <FileText className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Export PDF (Multi-Sheet) ({filteredEntries.length})</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg sm:text-xl">GD Reports</CardTitle>
              <CardDescription className="text-sm">
                Showing {filteredEntries.length} of {entries.length} entries
              </CardDescription>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Summary
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-gradient-primary">GD Summary</DialogTitle>
                </DialogHeader>
                {summary ? (
                  <div className="space-y-4">
                    <div className="text-center p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg">
                      <div className="text-3xl font-bold text-gradient-primary">{summary.totalEntries}</div>
                      <div className="text-sm text-muted-foreground">Total Entries</div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h4 className="font-semibold text-sm mb-2 text-gradient-secondary">By Shop</h4>
                        <div className="space-y-1">
                          {Object.entries(summary.byShop).map(([shop, count]) => (
                            <div key={shop} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                              <span>{shop}</span>
                              <span className="font-medium">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-sm mb-2 text-gradient-secondary">By Category</h4>
                        <div className="space-y-1">
                          {Object.entries(summary.byCategory).map(([category, count]) => (
                            <div key={category} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                              <span>{category}</span>
                              <span className="font-medium">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-sm mb-2 text-gradient-secondary">By Size</h4>
                        <div className="space-y-1">
                          {Object.entries(summary.bySize).map(([size, count]) => (
                            <div key={size} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                              <span>{size}</span>
                              <span className="font-medium">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-sm mb-2 text-gradient-secondary">By Customer Type</h4>
                        <div className="space-y-1">
                          {Object.entries(summary.byCustomerType).map(([type, count]) => (
                            <div key={type} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                              <span>{type}</span>
                              <span className="font-medium">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-sm mb-2 text-gradient-secondary">By Notes</h4>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {Object.entries(summary.byNotes)
                            .sort(([, a], [, b]) => b - a)
                            .map(([note, count]) => (
                              <div key={note} className="flex justify-between text-sm p-2 bg-muted/50 rounded gap-2">
                                <span className="flex-1 truncate" title={note}>{note}</span>
                                <span className="font-medium flex-shrink-0">{count}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">From:</span>
                        <span className="font-medium">{summary.firstDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">To:</span>
                        <span className="font-medium">{summary.lastDate}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No GD entries found.
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="min-w-0">
          <div className="space-y-4">
            {filteredEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No entries found matching the selected filters.
              </div>
            ) : (
              filteredEntries.map((entry) => (
                <div key={entry.id} className="border rounded-lg p-3 sm:p-4 space-y-3 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 min-w-0">
                      <Badge variant="outline" className="text-xs">{entry.shops.name}</Badge>
                      <Badge variant="secondary" className="text-xs">{entry.categories.name}</Badge>
                      <Badge variant="outline" className="text-xs">{entry.sizes.size}</Badge>
                    </div>
                    <span className="text-xs sm:text-sm text-muted-foreground flex-shrink-0">
                      {formatTime12Hour(new Date(entry.created_at))}
                    </span>
                  </div>
                  <div className="text-sm min-w-0">
                    <span className="font-medium">Reporter:</span>{' '}
                    <span className="break-words">{entry.employee_name || 'Unknown'}</span>
                  </div>
                  <div className="text-sm min-w-0 tamil-content">
                    <span className="font-medium">Notes:</span>{' '}
                    <span className="break-words tamil">
                      {entry.notes}
                    </span>
                  </div>
                  {entry.gd_entry_images.length > 0 && (
                    <div className="text-sm min-w-0">
                      <span className="font-medium">Images:</span>
                      <div className="mt-2">
                        <ImageDisplay images={entry.gd_entry_images} />
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
