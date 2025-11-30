import { useState, useEffect, useMemo, memo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { TrendingUp, Package, Calendar, CalendarDays, Sparkles, Filter, X, ArrowUpDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
interface SummaryData {
  today: number;
  thisWeek: number;
  thisMonth: number;
  total: number;
  byShop: Record<string, number>;
  byCategory: Record<string, number>;
  bySize: Record<string, number>;
  byCustomerType: Record<string, number>;
}

export const Dashboard = memo(() => {
  const { profile, isAdmin } = useAuth();
  
  // Filter states
  const [selectedShop, setSelectedShop] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCustomerType, setSelectedCustomerType] = useState<string>('all');
  const [customDateFrom, setCustomDateFrom] = useState<Date>();
  const [customDateTo, setCustomDateTo] = useState<Date>();
  const [showFilters, setShowFilters] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  // Fetch master data (shops, categories, customer types)
  const { data: masterData } = useQuery({
    queryKey: ['dashboard-master-data'],
    queryFn: async () => {
      const [shopsRes, categoriesRes, customerTypesRes] = await Promise.all([
        supabase.from('shops').select('*').is('deleted_at', null).order('name'),
        supabase.from('categories').select('*').is('deleted_at', null).order('name'),
        supabase.from('customer_types').select('*').is('deleted_at', null).order('name'),
      ]);

      return {
        shops: shopsRes.data || [],
        categories: categoriesRes.data || [],
        customerTypes: customerTypesRes.data || [],
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: summary, isLoading: loading, refetch } = useQuery({
    queryKey: ['dashboard-summary', profile?.id, selectedShop, selectedCategory, selectedCustomerType, customDateFrom, customDateTo],
    queryFn: async () => {
      if (!profile) throw new Error('No profile');

      // Build query
      let query = supabase
        .from('goods_damaged_entries')
        .select(`
          *,
          shops(name),
          categories(name),
          sizes(size),
          customer_types(name)
        `);

      // Apply filters
      if (selectedShop !== 'all') {
        query = query.eq('shop_id', selectedShop);
      }
      if (selectedCategory !== 'all') {
        query = query.eq('category_id', selectedCategory);
      }
      if (selectedCustomerType !== 'all') {
        query = query.eq('customer_type_id', selectedCustomerType);
      }
      if (customDateFrom) {
        query = query.gte('created_at', customDateFrom.toISOString());
      }
      if (customDateTo) {
        const endOfDay = new Date(customDateTo);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data: entries, error } = await query;

      if (error) {
        console.error('Dashboard query error:', error);
        throw error;
      }

      if (!entries || entries.length === 0) {
        return {
          today: 0,
          thisWeek: 0,
          thisMonth: 0,
          total: 0,
          byShop: {},
          byCategory: {},
          bySize: {},
          byCustomerType: {},
          prevToday: 0,
          prevWeek: 0,
          prevMonth: 0,
        };
      }

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Previous period boundaries
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      const prevMonthStart = new Date(monthStart);
      prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

      let todayCount = 0;
      let weekCount = 0;
      let monthCount = 0;
      let prevTodayCount = 0;
      let prevWeekCount = 0;
      let prevMonthCount = 0;

      const byShop: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      const bySize: Record<string, number> = {};
      const byCustomerType: Record<string, number> = {};

      entries.forEach((entry) => {
        const entryDate = new Date(entry.created_at);

        // Count by time periods
        if (entryDate >= todayStart) todayCount++;
        if (entryDate >= weekStart) weekCount++;
        if (entryDate >= monthStart) monthCount++;

        // Previous period counts
        if (entryDate >= yesterdayStart && entryDate < todayStart) prevTodayCount++;
        if (entryDate >= prevWeekStart && entryDate < weekStart) prevWeekCount++;
        if (entryDate >= prevMonthStart && entryDate < monthStart) prevMonthCount++;

        // Count by dimensions
        const shopName = (entry.shops as any)?.name || 'Unknown';
        byShop[shopName] = (byShop[shopName] || 0) + 1;

        const categoryName = (entry.categories as any)?.name || 'Unknown';
        byCategory[categoryName] = (byCategory[categoryName] || 0) + 1;

        const sizeName = (entry.sizes as any)?.size || 'Unknown';
        bySize[sizeName] = (bySize[sizeName] || 0) + 1;

        const customerType = (entry.customer_types as any)?.name || 'Unknown';
        byCustomerType[customerType] = (byCustomerType[customerType] || 0) + 1;
      });

      return {
        today: todayCount,
        thisWeek: weekCount,
        thisMonth: monthCount,
        total: entries.length,
        byShop,
        byCategory,
        bySize,
        byCustomerType,
        prevToday: prevTodayCount,
        prevWeek: prevWeekCount,
        prevMonth: prevMonthCount,
      };
    },
    enabled: !!profile && isAdmin,
    staleTime: 1000 * 60, // 1 minute
  });

  // Real-time subscription
  useEffect(() => {
    if (!profile || !isAdmin) return;

    const channel = supabase
      .channel('dashboard-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'goods_damaged_entries'
        },
        () => {
          console.log('GD entry changed, refreshing dashboard...');
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, isAdmin, refetch]);

  const clearFilters = () => {
    setSelectedShop('all');
    setSelectedCategory('all');
    setSelectedCustomerType('all');
    setCustomDateFrom(undefined);
    setCustomDateTo(undefined);
  };

  const hasActiveFilters = selectedShop !== 'all' || selectedCategory !== 'all' || 
    selectedCustomerType !== 'all' || customDateFrom || customDateTo;

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-6 px-4">
        <Package className="h-24 w-24 text-muted-foreground/20" />
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Dashboard Access</h2>
          <p className="text-muted-foreground max-w-md">
            Dashboard is only available for admin users.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3">
        <Sparkles className="h-8 w-8 text-primary animate-pulse" />
        <div className="text-lg font-medium text-primary">Loading your dashboard...</div>
      </div>
    );
  }

  if (!summary || summary.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-6 px-4">
        <div className="relative">
          <Package className="h-24 w-24 text-muted-foreground/20" />
          <Sparkles className="h-10 w-10 text-primary/50 absolute -top-2 -right-2" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Welcome to Your Dashboard!</h2>
          <p className="text-muted-foreground max-w-md">
            Start by creating your first GD entry. Click the "GD" tab below to get started.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl mt-8">
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-muted-foreground/50">0</div>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-muted-foreground/50">0</div>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-muted-foreground/50">0</div>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-muted-foreground/50">0</div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Header with Filters */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Your GD Summary</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowComparison(!showComparison)}
            className="gap-2"
          >
            <ArrowUpDown className="h-4 w-4" />
            {showComparison ? 'Hide' : 'Show'} Comparison
          </Button>
          <Button
            variant={hasActiveFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && <span className="ml-1 bg-background text-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">!</span>}
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Advanced Filters</CardTitle>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2">
                  <X className="h-4 w-4" />
                  Clear All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Shop</Label>
                <Select value={selectedShop} onValueChange={setSelectedShop}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Shops" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Shops</SelectItem>
                    {masterData?.shops.map(shop => (
                      <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {masterData?.categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Customer Type</Label>
                <Select value={selectedCustomerType} onValueChange={setSelectedCustomerType}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {masterData?.customerTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <Calendar className="mr-2 h-4 w-4" />
                      {customDateFrom ? format(customDateFrom, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={customDateFrom}
                      onSelect={setCustomDateFrom}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>To Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <Calendar className="mr-2 h-4 w-4" />
                      {customDateTo ? format(customDateTo, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={customDateTo}
                      onSelect={setCustomDateTo}
                      disabled={(date) => {
                        const today = new Date();
                        today.setHours(23, 59, 59, 999);
                        if (date > today) return true;
                        if (customDateFrom) return date < customDateFrom;
                        return false;
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time-based Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="group hover-glow border-2 border-primary/20 hover:border-primary/40 transition-all duration-300 cursor-pointer overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-primary">Today</CardTitle>
            <Calendar className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gradient-primary">{summary.today}</div>
            <p className="text-xs text-muted-foreground mt-1">Today's entries</p>
            {showComparison && (
              <div className={`text-xs font-medium mt-2 flex items-center gap-1 ${
                calculateChange(summary.today, summary.prevToday) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {calculateChange(summary.today, summary.prevToday) >= 0 ? '↑' : '↓'}
                {Math.abs(calculateChange(summary.today, summary.prevToday))}% vs yesterday
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="group hover-glow border-2 border-accent/20 hover:border-accent/40 transition-all duration-300 cursor-pointer overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-accent">This Week</CardTitle>
            <CalendarDays className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gradient-accent">{summary.thisWeek}</div>
            <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
            {showComparison && (
              <div className={`text-xs font-medium mt-2 flex items-center gap-1 ${
                calculateChange(summary.thisWeek, summary.prevWeek) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {calculateChange(summary.thisWeek, summary.prevWeek) >= 0 ? '↑' : '↓'}
                {Math.abs(calculateChange(summary.thisWeek, summary.prevWeek))}% vs last week
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="group hover-glow border-2 border-secondary/20 hover:border-secondary/40 transition-all duration-300 cursor-pointer overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-secondary">This Month</CardTitle>
            <TrendingUp className="h-5 w-5 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gradient-secondary">{summary.thisMonth}</div>
            <p className="text-xs text-muted-foreground mt-1">Current month</p>
            {showComparison && (
              <div className={`text-xs font-medium mt-2 flex items-center gap-1 ${
                calculateChange(summary.thisMonth, summary.prevMonth) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {calculateChange(summary.thisMonth, summary.prevMonth) >= 0 ? '↑' : '↓'}
                {Math.abs(calculateChange(summary.thisMonth, summary.prevMonth))}% vs last month
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="group hover-glow border-2 border-primary/20 hover:border-primary/40 transition-all duration-300 cursor-pointer overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-primary">Total</CardTitle>
            <Package className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gradient-primary">{summary.total}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Shop */}
        <Card className="hover-glow border-primary/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <div className="h-1 w-8 bg-gradient-to-r from-primary to-primary/50 rounded-full" />
              <span className="text-gradient-primary">By Shop</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(summary.byShop).length > 0 ? (
              Object.entries(summary.byShop)
                .sort(([, a], [, b]) => b - a)
                .map(([name, count], idx) => (
                  <div key={name} className="flex justify-between items-center p-3 rounded-lg bg-gradient-to-r from-muted/50 to-transparent hover:from-muted hover:to-muted/50 transition-all duration-200 border border-transparent hover:border-primary/20">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-bold text-primary/60 w-6 text-center">{idx + 1}</span>
                      <span className="font-medium truncate">{name}</span>
                    </div>
                    <span className="font-bold text-primary text-lg ml-2">{count}</span>
                  </div>
                ))
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">No shop data</p>
            )}
          </CardContent>
        </Card>

        {/* By Category */}
        <Card className="hover-glow border-accent/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <div className="h-1 w-8 bg-gradient-to-r from-accent to-accent/50 rounded-full" />
              <span className="text-gradient-accent">By Category</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(summary.byCategory).length > 0 ? (
              Object.entries(summary.byCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([name, count], idx) => (
                  <div key={name} className="flex justify-between items-center p-3 rounded-lg bg-gradient-to-r from-muted/50 to-transparent hover:from-muted hover:to-muted/50 transition-all duration-200 border border-transparent hover:border-accent/20">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-bold text-accent/60 w-6 text-center">{idx + 1}</span>
                      <span className="font-medium truncate">{name}</span>
                    </div>
                    <span className="font-bold text-accent text-lg ml-2">{count}</span>
                  </div>
                ))
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">No category data</p>
            )}
          </CardContent>
        </Card>

        {/* By Size */}
        <Card className="hover-glow border-secondary/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <div className="h-1 w-8 bg-gradient-to-r from-secondary to-secondary/50 rounded-full" />
              <span className="text-gradient-secondary">By Size</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(summary.bySize).length > 0 ? (
              Object.entries(summary.bySize)
                .sort(([, a], [, b]) => b - a)
                .map(([name, count], idx) => (
                  <div key={name} className="flex justify-between items-center p-3 rounded-lg bg-gradient-to-r from-muted/50 to-transparent hover:from-muted hover:to-muted/50 transition-all duration-200 border border-transparent hover:border-secondary/20">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-bold text-secondary/60 w-6 text-center">{idx + 1}</span>
                      <span className="font-medium truncate">{name}</span>
                    </div>
                    <span className="font-bold text-secondary text-lg ml-2">{count}</span>
                  </div>
                ))
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">No size data</p>
            )}
          </CardContent>
        </Card>

        {/* By Customer Type */}
        <Card className="hover-glow border-primary/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <div className="h-1 w-8 bg-gradient-to-r from-primary to-primary/50 rounded-full" />
              <span className="text-gradient-primary">By Customer Type</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(summary.byCustomerType).length > 0 ? (
              Object.entries(summary.byCustomerType)
                .sort(([, a], [, b]) => b - a)
                .map(([name, count], idx) => (
                  <div key={name} className="flex justify-between items-center p-3 rounded-lg bg-gradient-to-r from-muted/50 to-transparent hover:from-muted hover:to-muted/50 transition-all duration-200 border border-transparent hover:border-primary/20">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-bold text-primary/60 w-6 text-center">{idx + 1}</span>
                      <span className="font-medium truncate">{name}</span>
                    </div>
                    <span className="font-bold text-primary text-lg ml-2">{count}</span>
                  </div>
                ))
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">No customer type data</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
});