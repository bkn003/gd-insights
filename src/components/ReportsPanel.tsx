
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/types/database';
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { DateRangeFilter, DateRangePreset } from '@/components/DateRangeFilter';

import { FileText, Download, Search, Building2, Tag, User, Eye, Calendar as CalendarIcon2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface GDEntry {
  id: string;
  category_id: string;
  size_id: string;
  employee_id: string;
  employee_name: string | null;
  shop_id: string;
  notes: string;
  created_at: string;
  updated_at: string;
  image_url: string | null;
  shops: { name: string } | null;
  categories: { name: string } | null;
  sizes: { size: string } | null;
}

interface FilterState {
  shopId: string | null;
  categoryId: string | null;
  sizeId: string | null;
  datePreset: DateRangePreset;
  dateFrom: Date | null;
  dateTo: Date | null;
  searchTerm: string;
}

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return 'Unknown';
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
};

const getImageDataURL = async (imageUrl: string): Promise<string | null> => {
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
    console.error('Error converting image to base64:', error);
    return null;
  }
};

// Set today as default date range
const getDefaultDateRange = () => {
  const now = new Date();
  return {
    datePreset: 'today' as DateRangePreset,
    dateFrom: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    dateTo: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
  };
};

export const ReportsPanel = () => {
  const [entries, setEntries] = useState<GDEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState<Database['public']['Tables']['shops']['Row'][]>([]);
  const [categories, setCategories] = useState<Database['public']['Tables']['categories']['Row'][]>([]);
  const [sizes, setSizes] = useState<Database['public']['Tables']['sizes']['Row'][]>([]);
  
  const defaultDateRange = getDefaultDateRange();
  const [filter, setFilter] = useState<FilterState>({
    shopId: null,
    categoryId: null,
    sizeId: null,
    datePreset: defaultDateRange.datePreset,
    dateFrom: defaultDateRange.dateFrom,
    dateTo: defaultDateRange.dateTo,
    searchTerm: '',
  });
  const [filteredEntries, setFilteredEntries] = useState<GDEntry[]>([]);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: entriesData, error: entriesError },
        { data: shopsData, error: shopsError },
        { data: categoriesData, error: categoriesError },
        { data: sizesData, error: sizesError },
      ] = await Promise.all([
        supabase
          .from('goods_damaged_entries')
          .select('*, shops(name), categories(name), sizes(size)'),
        supabase.from('shops').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('sizes').select('*').order('size'),
      ]);

      if (entriesError) throw entriesError;
      if (shopsError) throw shopsError;
      if (categoriesError) throw categoriesError;
      if (sizesError) throw sizesError;

      // Type assertion and filtering to ensure proper data structure
      const processedEntries: GDEntry[] = (entriesData || []).map(entry => {
        // Handle shops relationship
        const shops = entry.shops && typeof entry.shops === 'object' && 'name' in entry.shops ? entry.shops : null;
        
        // Handle categories relationship with explicit type checking
        let categories: { name: string } | null = null;
        const categoryData = entry.categories as any;
        if (categoryData && typeof categoryData === 'object' && 'name' in categoryData) {
          categories = { name: categoryData.name };
        }
        
        // Handle sizes relationship with explicit type checking
        let sizes: { size: string } | null = null;
        const sizeData = entry.sizes as any;
        if (sizeData && typeof sizeData === 'object' && 'size' in sizeData) {
          sizes = { size: sizeData.size };
        }
        
        return {
          ...entry,
          shops,
          categories,
          sizes,
        };
      });

      setEntries(processedEntries);
      setShops(shopsData || []);
      setCategories(categoriesData || []);
      setSizes(sizesData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch data",
        variant: "destructive",
      })
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    applyFilters();
  }, [entries, filter]);

  const applyFilters = () => {
    let results = [...entries];

    if (filter.shopId) {
      results = results.filter(entry => entry.shop_id === filter.shopId);
    }
    if (filter.categoryId) {
      results = results.filter(entry => entry.category_id === filter.categoryId);
    }
    if (filter.sizeId) {
      results = results.filter(entry => entry.size_id === filter.sizeId);
    }
    if (filter.dateFrom) {
      results = results.filter(entry => entry.created_at && new Date(entry.created_at) >= filter.dateFrom!);
    }
    if (filter.dateTo) {
      results = results.filter(entry => entry.created_at && new Date(entry.created_at) <= filter.dateTo!);
    }
    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      results = results.filter(entry =>
        (entry.notes && entry.notes.toLowerCase().includes(term)) ||
        (entry.employee_name && entry.employee_name.toLowerCase().includes(term)) ||
        (entry.shops?.name && entry.shops.name.toLowerCase().includes(term)) ||
        (entry.categories?.name && entry.categories.name.toLowerCase().includes(term)) ||
        (entry.sizes?.size && entry.sizes.size.toLowerCase().includes(term))
      );
    }

    setFilteredEntries(results);
  };

  const handleShopFilterChange = (shopId: string) => {
    setFilter(prev => ({ ...prev, shopId: shopId === 'all' ? null : shopId }));
  };

  const handleCategoryFilterChange = (categoryId: string) => {
    setFilter(prev => ({ ...prev, categoryId: categoryId === 'all' ? null : categoryId }));
  };

  const handleSizeFilterChange = (sizeId: string) => {
    setFilter(prev => ({ ...prev, sizeId: sizeId === 'all' ? null : sizeId }));
  };

  const handlePresetChange = (preset: DateRangePreset) => {
    setFilter(prev => ({ ...prev, datePreset: preset }));
  };

  const handleDateFromChange = (date: Date | undefined) => {
    setFilter(prev => ({ ...prev, dateFrom: date || null }));
  };

  const handleDateToChange = (date: Date | undefined) => {
    setFilter(prev => ({ ...prev, dateTo: date || null }));
  };

  const handleSearchTermChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(prev => ({ ...prev, searchTerm: e.target.value }));
  };

  const clearSearch = () => {
    setFilter(prev => ({ ...prev, searchTerm: '' }));
  };

  const exportToExcel = async () => {
    const processedData = await Promise.all(
      filteredEntries.map(async (entry) => {
        const imageData = entry.image_url ? await getImageDataURL(entry.image_url) : null;
        
        return {
          'Entry ID': entry.id,
          'Date': formatDate(entry.created_at),
          'Shop': entry.shops?.name || 'Unknown',
          'Category': entry.categories?.name || 'Unknown',
          'Size': entry.sizes?.size || 'Unknown',
          'Employee': entry.employee_name || 'Unknown',
          'Notes': entry.notes,
          'Image': imageData ? 'IMAGE_DATA:' + imageData : 'No Image'
        };
      })
    );

    const wb = XLSX.utils.book_new();
    
    // Overall Sheet
    const overallWs = XLSX.utils.json_to_sheet(processedData);
    XLSX.utils.book_append_sheet(wb, overallWs, 'Overall Report');
    
    // Shop-wise sheets
    const uniqueShops = [...new Set(filteredEntries.map(entry => entry.shops?.name).filter(Boolean))];
    uniqueShops.forEach(shop => {
      const shopData = processedData.filter(entry => entry.Shop === shop);
      if (shopData.length > 0) {
        const shopWs = XLSX.utils.json_to_sheet(shopData);
        XLSX.utils.book_append_sheet(wb, shopWs, `${shop}`.substring(0, 31));
      }
    });
    
    // Category-wise sheets
    const uniqueCategories = [...new Set(filteredEntries.map(entry => entry.categories?.name).filter(Boolean))];
    uniqueCategories.forEach(category => {
      const categoryData = processedData.filter(entry => entry.Category === category);
      if (categoryData.length > 0) {
        const categoryWs = XLSX.utils.json_to_sheet(categoryData);
        XLSX.utils.book_append_sheet(wb, categoryWs, `${category}`.substring(0, 31));
      }
    });

    const fileName = `GD_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const exportReportPDF = async () => {
    const processedData = await Promise.all(
      filteredEntries.map(async (entry) => ({
        'Entry ID': entry.id.substring(0, 8),
        'Date': formatDate(entry.created_at),
        'Shop': entry.shops?.name || 'Unknown',
        'Category': entry.categories?.name || 'Unknown',
        'Size': entry.sizes?.size || 'Unknown',
        'Employee': entry.employee_name || 'Unknown',
        'Notes': entry.notes.substring(0, 50) + (entry.notes.length > 50 ? '...' : ''),
        'Image': entry.image_url ? 'Yes' : 'No'
      }))
    );

    const doc = new jsPDF();
    
    // Overall Report
    doc.setFontSize(16);
    doc.text('Overall GD Report', 14, 20);
    
    doc.autoTable({
      head: [Object.keys(processedData[0] || {})],
      body: processedData.map(row => Object.values(row)),
      startY: 30,
      styles: { fontSize: 8 },
      columnStyles: {
        6: { cellWidth: 30 } // Notes column
      }
    });

    // Shop-wise reports
    const uniqueShops = [...new Set(filteredEntries.map(entry => entry.shops?.name).filter(Boolean))];
    uniqueShops.forEach(shop => {
      const shopData = processedData.filter(entry => entry.Shop === shop);
      if (shopData.length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.text(`${shop} - GD Report`, 14, 20);
        
        doc.autoTable({
          head: [Object.keys(shopData[0])],
          body: shopData.map(row => Object.values(row)),
          startY: 30,
          styles: { fontSize: 8 },
          columnStyles: {
            6: { cellWidth: 30 }
          }
        });
      }
    });

    // Category-wise reports
    const uniqueCategories = [...new Set(filteredEntries.map(entry => entry.categories?.name).filter(Boolean))];
    uniqueCategories.forEach(category => {
      const categoryData = processedData.filter(entry => entry.Category === category);
      if (categoryData.length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.text(`${category} - GD Report`, 14, 20);
        
        doc.autoTable({
          head: [Object.keys(categoryData[0])],
          body: categoryData.map(row => Object.values(row)),
          startY: 30,
          styles: { fontSize: 8 },
          columnStyles: {
            6: { cellWidth: 30 }
          }
        });
      }
    });

    const fileName = `GD_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="space-y-6">
      <div className="bg-muted p-4 rounded-md">
        <h3 className="text-lg font-semibold mb-4">Filters</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <Label htmlFor="shop">Shop</Label>
            <Select value={filter.shopId || 'all'} onValueChange={handleShopFilterChange}>
              <SelectTrigger>
                <SelectValue placeholder="All Shops" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Shops</SelectItem>
                {shops.map((shop) => (
                  <SelectItem key={shop.id} value={shop.id}>
                    {shop.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Select value={filter.categoryId || 'all'} onValueChange={handleCategoryFilterChange}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="size">Size</Label>
            <Select value={filter.sizeId || 'all'} onValueChange={handleSizeFilterChange}>
              <SelectTrigger>
                <SelectValue placeholder="All Sizes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sizes</SelectItem>
                {sizes.map((size) => (
                  <SelectItem key={size.id} value={size.id}>
                    {size.size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <DateRangeFilter
            selectedPreset={filter.datePreset}
            dateFrom={filter.dateFrom}
            dateTo={filter.dateTo}
            onPresetChange={handlePresetChange}
            onDateFromChange={handleDateFromChange}
            onDateToChange={handleDateToChange}
          />

          <div>
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Input
                type="search"
                id="search"
                placeholder="Search notes, employee, shop..."
                value={filter.searchTerm}
                onChange={handleSearchTermChange}
                className="pr-10"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {filter.searchTerm ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearSearch}
                    className="h-6 w-6 p-0"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                ) : (
                  <Search className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold">GD Reports</h2>
            <p className="text-muted-foreground">
              {loading ? 'Loading...' : `Total entries: ${filteredEntries.length}`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button onClick={exportToExcel} variant="outline" className="flex items-center justify-center gap-2 w-full sm:w-auto">
              <Download className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Export Excel ({filteredEntries.length})</span>
            </Button>
            <Button onClick={exportReportPDF} variant="outline" className="flex items-center justify-center gap-2 w-full sm:w-auto">
              <FileText className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Export PDF ({filteredEntries.length})</span>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p>Loading reports...</p>
            </div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No entries found matching your criteria.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredEntries.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CalendarIcon2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {formatDate(entry.created_at)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{entry.shops?.name || 'Unknown'}</span>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-muted-foreground" />
                          <span>{entry.categories?.name || 'Unknown'}</span>
                        </div>
                        <div className="text-sm px-2 py-1 bg-secondary rounded">
                          {entry.sizes?.size || 'Unknown'}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{entry.employee_name || 'Unknown'}</span>
                      </div>
                      
                      <div className="mt-3">
                        <p className="text-sm font-medium mb-1">Notes:</p>
                        <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                          {entry.notes}
                        </p>
                      </div>
                    </div>
                    
                    {entry.image_url && (
                      <div className="flex justify-center lg:justify-end">
                        <div className="max-w-xs">
                          <img
                            src={entry.image_url}
                            alt="GD Evidence"
                            className="w-full h-auto max-h-48 object-cover rounded-lg border"
                            loading="lazy"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
