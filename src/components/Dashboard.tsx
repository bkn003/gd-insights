import { useState, useEffect, useMemo, memo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Package, Calendar, CalendarDays, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
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

  const { data: summary, isLoading: loading } = useQuery({
    queryKey: ['dashboard-summary', profile?.id],
    queryFn: async () => {
      if (!profile) throw new Error('No profile');

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
          byCustomerType: {}
        };
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

      return {
        today: todayCount,
        thisWeek: weekCount,
        thisMonth: monthCount,
        total: entries.length,
        byShop,
        byCategory,
        bySize,
        byCustomerType
      };
    },
    enabled: !!profile,
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 1000 * 60 * 5, // Refresh every 5 minutes
  });

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
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Sparkles className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Your GD Summary</h1>
      </div>

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