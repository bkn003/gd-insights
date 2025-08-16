import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Package, AlertTriangle, Building } from 'lucide-react';
interface DashboardStats {
  totalEntries: number;
  entriesThisMonth: number;
  categoriesCount: number;
  shopsCount: number;
}
interface CategoryStats {
  name: string;
  count: number;
}
interface ShopStats {
  name: string;
  count: number;
}
export const Dashboard = () => {
  const {
    profile,
    isAdmin
  } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalEntries: 0,
    entriesThisMonth: 0,
    categoriesCount: 0,
    shopsCount: 0
  });
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [shopStats, setShopStats] = useState<ShopStats[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchDashboardData();
  }, [profile]);
  const fetchDashboardData = async () => {
    if (!profile) return;
    try {
      setLoading(true);

      // Fetch basic stats
      const [entriesRes, categoriesRes, shopsRes] = await Promise.all([supabase.from('goods_damaged_entries').select('*'), supabase.from('categories').select('*'), supabase.from('shops').select('*')]);
      if (entriesRes.error) throw entriesRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (shopsRes.error) throw shopsRes.error;
      const entries = entriesRes.data || [];
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const entriesThisMonth = entries.filter(entry => {
        const entryDate = new Date(entry.created_at);
        return entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear;
      }).length;
      setStats({
        totalEntries: entries.length,
        entriesThisMonth,
        categoriesCount: categoriesRes.data.length,
        shopsCount: shopsRes.data.length
      });

      // Fetch category stats
      const {
        data: categoryStatsData
      } = await supabase.from('goods_damaged_entries').select(`
          category_id,
          categories (name)
        `);
      if (categoryStatsData) {
        const categoryMap = new Map<string, number>();
        categoryStatsData.forEach(entry => {
          const categoryName = (entry.categories as any)?.name || 'Unknown';
          categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + 1);
        });
        setCategoryStats(Array.from(categoryMap.entries()).map(([name, count]) => ({
          name,
          count
        })));
      }

      // Fetch shop stats
      const {
        data: shopStatsData
      } = await supabase.from('goods_damaged_entries').select(`
          shop_id,
          shops (name)
        `);
      if (shopStatsData) {
        const shopMap = new Map<string, number>();
        shopStatsData.forEach(entry => {
          const shopName = (entry.shops as any)?.name || 'Unknown';
          shopMap.set(shopName, (shopMap.get(shopName) || 0) + 1);
        });
        setShopStats(Array.from(shopMap.entries()).map(([name, count]) => ({
          name,
          count
        })));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];
  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading dashboard...</div>;
  }
  return <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEntries}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.entriesThisMonth}</div>
            <p className="text-xs text-muted-foreground">New entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.categoriesCount}</div>
            <p className="text-xs text-muted-foreground">Total categories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shops</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.shopsCount}</div>
            <p className="text-xs text-muted-foreground">Total shops</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Entries by Category</CardTitle>
            <CardDescription>Distribution of GD by category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entries by Shop</CardTitle>
            <CardDescription>Distribution of GD by shop</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={shopStats} cx="50%" cy="50%" labelLine={false} label={({
                name,
                percent
              }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="count">
                  {shopStats.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>;
};