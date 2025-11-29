import { useState, useEffect, useMemo, memo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Package, Calendar, CalendarDays } from 'lucide-react';
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
  const { profile } = useAuth();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [profile]);

  const fetchDashboardData = async () => {
    if (!profile) return;
    try {
      setLoading(true);

      // Fetch all entries with related data
      const { data: entries, error } = await supabase
        .from('goods_damaged_entries')
        .select(`
          *,
          shops(name),
          categories(name),
          sizes(size),
          customer_types(name)
        `);

      if (error) throw error;

      if (!entries || entries.length === 0) {
        setSummary({
          today: 0,
          thisWeek: 0,
          thisMonth: 0,
          total: 0,
          byShop: {},
          byCategory: {},
          bySize: {},
          byCustomerType: {}
        });
        return;
      }

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      let todayCount = 0;
      let weekCount = 0;
      let monthCount = 0;

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

      setSummary({
        today: todayCount,
        thisWeek: weekCount,
        thisMonth: monthCount,
        total: entries.length,
        byShop,
        byCategory,
        bySize,
        byCustomerType
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time-based Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="hover-glow border-2 border-primary/20 hover:border-primary/40 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-primary">Today</CardTitle>
            <Calendar className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gradient-primary">{summary.today}</div>
            <p className="text-xs text-muted-foreground mt-1">Today's entries</p>
          </CardContent>
        </Card>

        <Card className="hover-glow border-2 border-accent/20 hover:border-accent/40 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-accent">This Week</CardTitle>
            <CalendarDays className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gradient-accent">{summary.thisWeek}</div>
            <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
          </CardContent>
        </Card>

        <Card className="hover-glow border-2 border-secondary/20 hover:border-secondary/40 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-secondary">This Month</CardTitle>
            <TrendingUp className="h-5 w-5 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gradient-secondary">{summary.thisMonth}</div>
            <p className="text-xs text-muted-foreground mt-1">Current month</p>
          </CardContent>
        </Card>

        <Card className="hover-glow border-2 border-primary/20 hover:border-primary/40 transition-all duration-300">
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
        <Card className="hover-glow">
          <CardHeader>
            <CardTitle className="text-gradient-primary">By Shop</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(summary.byShop).length > 0 ? (
              Object.entries(summary.byShop)
                .sort(([, a], [, b]) => b - a)
                .map(([name, count]) => (
                  <div key={name} className="flex justify-between items-center p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <span className="font-medium truncate flex-1 pr-2">{name}</span>
                    <span className="font-bold text-primary">{count}</span>
                  </div>
                ))
            ) : (
              <p className="text-muted-foreground text-sm">No shop data</p>
            )}
          </CardContent>
        </Card>

        {/* By Category */}
        <Card className="hover-glow">
          <CardHeader>
            <CardTitle className="text-gradient-accent">By Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(summary.byCategory).length > 0 ? (
              Object.entries(summary.byCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([name, count]) => (
                  <div key={name} className="flex justify-between items-center p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <span className="font-medium truncate flex-1 pr-2">{name}</span>
                    <span className="font-bold text-accent">{count}</span>
                  </div>
                ))
            ) : (
              <p className="text-muted-foreground text-sm">No category data</p>
            )}
          </CardContent>
        </Card>

        {/* By Size */}
        <Card className="hover-glow">
          <CardHeader>
            <CardTitle className="text-gradient-secondary">By Size</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(summary.bySize).length > 0 ? (
              Object.entries(summary.bySize)
                .sort(([, a], [, b]) => b - a)
                .map(([name, count]) => (
                  <div key={name} className="flex justify-between items-center p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <span className="font-medium truncate flex-1 pr-2">{name}</span>
                    <span className="font-bold text-secondary">{count}</span>
                  </div>
                ))
            ) : (
              <p className="text-muted-foreground text-sm">No size data</p>
            )}
          </CardContent>
        </Card>

        {/* By Customer Type */}
        <Card className="hover-glow">
          <CardHeader>
            <CardTitle className="text-gradient-primary">By Customer Type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(summary.byCustomerType).length > 0 ? (
              Object.entries(summary.byCustomerType)
                .sort(([, a], [, b]) => b - a)
                .map(([name, count]) => (
                  <div key={name} className="flex justify-between items-center p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <span className="font-medium truncate flex-1 pr-2">{name}</span>
                    <span className="font-bold text-primary">{count}</span>
                  </div>
                ))
            ) : (
              <p className="text-muted-foreground text-sm">No customer type data</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
});