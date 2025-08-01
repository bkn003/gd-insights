import { useState, useEffect } from 'react';
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
import { toast } from 'sonner';
import { Download, Filter, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Database } from '@/types/database';
import * as XLSX from 'xlsx';

type GoodsEntry = Database['public']['Tables']['goods_damaged_entries']['Row'] & {
  categories: { name: string };
  sizes: { size: string };
  shops: { name: string };
};

type Shop = Database['public']['Tables']['shops']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type Size = Database['public']['Tables']['sizes']['Row'];

export const ReportsPanel = () => {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<GoodsEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<GoodsEntry[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  
  // Filter states - changed default to "today"
  const [selectedShop, setSelectedShop] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSize, setSelectedSize] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [customDateFrom, setCustomDateFrom] = useState<Date>();
  const [customDateTo, setCustomDateTo] = useState<Date>();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [entries, selectedShop, selectedCategory, selectedSize, dateFilter, customDateFrom, customDateTo]);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('Starting to fetch data...');
      
      // Fetch entries with manual joins to avoid foreign key relationship conflicts
      const { data: entriesData, error: entriesError } = await supabase
        .from('goods_damaged_entries')
        .select('*')
        .order('created_at', { ascending: false });

      if (entriesError) {
        console.error('Error fetching entries:', entriesError);
        throw entriesError;
      }

      console.log('Fetched entries:', entriesData);

      // Fetch related data separately
      const [shopsRes, categoriesRes, sizesRes] = await Promise.all([
        supabase.from('shops').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('sizes').select('*').order('size'),
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

      console.log('Fetched shops:', shopsRes.data);
      console.log('Fetched categories:', categoriesRes.data);
      console.log('Fetched sizes:', sizesRes.data);

      // Manually join the data
      const enrichedEntries = entriesData.map(entry => {
        const shop = shopsRes.data.find(s => s.id === entry.shop_id);
        const category = categoriesRes.data.find(c => c.id === entry.category_id);
        const size = sizesRes.data.find(s => s.id === entry.size_id);

        return {
          ...entry,
          shops: { name: shop?.name || 'Unknown Shop' },
          categories: { name: category?.name || 'Unknown Category' },
          sizes: { size: size?.size || 'Unknown Size' }
        };
      });

      console.log('Enriched entries:', enrichedEntries);

      setEntries(enrichedEntries);
      setShops(shopsRes.data);
      setCategories(categoriesRes.data);
      setSizes(sizesRes.data);
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

  const formatTime12Hour = (date: Date) => {
    return format(date, 'yyyy-MM-dd hh:mm a');
  };

  const createWorksheetData = (entries: GoodsEntry[]) => {
    const headers = ['Date', 'Shop', 'Category', 'Size', 'Reporter', 'Notes'];
    const rows = entries.map(entry => [
      formatTime12Hour(new Date(entry.created_at)),
      entry.shops.name,
      entry.categories.name,
      entry.sizes.size,
      entry.employee_name || 'Unknown',
      entry.notes
    ]);
    
    return [headers, ...rows];
  };

  const exportToExcel = () => {
    if (filteredEntries.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Filter entries for Big Shop and Small Shop
    const bigShopEntries = filteredEntries.filter(entry => entry.shops.name === 'Big Shop');
    const smallShopEntries = filteredEntries.filter(entry => entry.shops.name === 'Small Shop');

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Create worksheets
    const overallWS = XLSX.utils.aoa_to_sheet(createWorksheetData(filteredEntries));
    const bigShopWS = XLSX.utils.aoa_to_sheet(createWorksheetData(bigShopEntries));
    const smallShopWS = XLSX.utils.aoa_to_sheet(createWorksheetData(smallShopEntries));

    // Add worksheets to workbook
    XLSX.utils.book_append_sheet(workbook, overallWS, 'Overall Report');
    XLSX.utils.book_append_sheet(workbook, bigShopWS, 'Big Shop Report');
    XLSX.utils.book_append_sheet(workbook, smallShopWS, 'Small Shop Report');

    // Set column widths for all sheets
    const colWidths = [
      { wch: 20 }, // Date
      { wch: 15 }, // Shop
      { wch: 15 }, // Category
      { wch: 10 }, // Size
      { wch: 15 }, // Reporter
      { wch: 30 }  // Notes
    ];
    
    overallWS['!cols'] = colWidths;
    bigShopWS['!cols'] = colWidths;
    smallShopWS['!cols'] = colWidths;

    // Generate filename and download
    const fileName = `gd_report_3sheets_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    toast.success(`Excel report exported successfully! Overall: ${filteredEntries.length}, Big Shop: ${bigShopEntries.length}, Small Shop: ${smallShopEntries.length} entries`);
  };

  const clearFilters = () => {
    setSelectedShop('all');
    setSelectedCategory('all');
    setSelectedSize('all');
    setDateFilter('today'); // Changed default back to "today"
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
            Filter and export GD reports (Export includes 3 separate sheets: Overall, Big Shop, Small Shop)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mobile-friendly grid layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
            <Button onClick={exportToExcel} className="flex items-center justify-center gap-2 w-full sm:w-auto">
              <Download className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Export 3-Sheet Excel ({filteredEntries.length})</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">GD Reports</CardTitle>
          <CardDescription className="text-sm">
            Showing {filteredEntries.length} of {entries.length} entries
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          <div className="space-y-4">
            {filteredEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No entries found matching the selected filters.
              </div>
            ) : (
              filteredEntries.map((entry) => (
                <div key={entry.id} className="border rounded-lg p-3 sm:p-4 space-y-2 min-w-0">
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
                  <div className="text-sm min-w-0">
                    <span className="font-medium">Notes:</span>{' '}
                    <span className="break-words">{entry.notes}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
