
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Users, Building, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Database } from '@/types/database';

type Shop = Database['public']['Tables']['shops']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type Size = Database['public']['Tables']['sizes']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

export const AdminPanel = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    shopName: '',
    categoryName: '',
    sizeName: '',
    userRole: 'user' as 'admin' | 'user',
    userShopId: '',
    selectedUserId: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [shopsRes, categoriesRes, sizesRes, profilesRes] = await Promise.all([
        supabase.from('shops').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('sizes').select('*').order('size'),
        supabase.from('profiles').select('*').order('name'),
      ]);

      if (shopsRes.error) throw shopsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (sizesRes.error) throw sizesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      setShops(shopsRes.data);
      setCategories(categoriesRes.data);
      setSizes(sizesRes.data);
      setProfiles(profilesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShop = async () => {
    if (!formData.shopName.trim()) return;

    try {
      const { error } = await supabase
        .from('shops')
        .insert({ name: formData.shopName.trim() });

      if (error) throw error;

      toast.success('Shop created successfully');
      setFormData({ ...formData, shopName: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create shop');
    }
  };

  const handleCreateCategory = async () => {
    if (!formData.categoryName.trim()) return;

    try {
      const { error } = await supabase
        .from('categories')
        .insert({ name: formData.categoryName.trim() });

      if (error) throw error;

      toast.success('Category created successfully');
      setFormData({ ...formData, categoryName: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create category');
    }
  };

  const handleCreateSize = async () => {
    if (!formData.sizeName.trim()) return;

    try {
      const { error } = await supabase
        .from('sizes')
        .insert({ size: formData.sizeName.trim() });

      if (error) throw error;

      toast.success('Size created successfully');
      setFormData({ ...formData, sizeName: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create size');
    }
  };

  const handleUpdateUserRole = async () => {
    if (!formData.selectedUserId) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          role: formData.userRole,
          shop_id: formData.userShopId || null 
        })
        .eq('id', formData.selectedUserId);

      if (error) throw error;

      toast.success('User updated successfully');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user');
    }
  };

  const handleDeleteShop = async (id: string) => {
    try {
      const { error } = await supabase
        .from('shops')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Shop deleted successfully');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete shop');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Category deleted successfully');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete category');
    }
  };

  const handleDeleteSize = async (id: string) => {
    try {
      const { error } = await supabase
        .from('sizes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Size deleted successfully');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete size');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading admin panel...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shops Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Shops Management
            </CardTitle>
            <CardDescription>Add and manage shops</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Shop name"
                value={formData.shopName}
                onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
              />
              <Button onClick={handleCreateShop}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {shops.map((shop) => (
                <div key={shop.id} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm">{shop.name}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteShop(shop.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Categories Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Categories Management
            </CardTitle>
            <CardDescription>Add and manage categories</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Category name"
                value={formData.categoryName}
                onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
              />
              <Button onClick={handleCreateCategory}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm">{category.name}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteCategory(category.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sizes Management */}
        <Card>
          <CardHeader>
            <CardTitle>Sizes Management</CardTitle>
            <CardDescription>Add and manage sizes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Size name"
                value={formData.sizeName}
                onChange={(e) => setFormData({ ...formData, sizeName: e.target.value })}
              />
              <Button onClick={handleCreateSize}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {sizes.map((size) => (
                <div key={size.id} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm">{size.size}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteSize(size.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
          <CardDescription>Manage user roles and shop assignments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <Select
              value={formData.selectedUserId}
              onValueChange={(value) => setFormData({ ...formData, selectedUserId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={formData.userRole}
              onValueChange={(value) => setFormData({ ...formData, userRole: value as 'admin' | 'user' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={formData.userShopId}
              onValueChange={(value) => setFormData({ ...formData, userShopId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select shop" />
              </SelectTrigger>
              <SelectContent>
                {shops.map((shop) => (
                  <SelectItem key={shop.id} value={shop.id}>
                    {shop.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleUpdateUserRole}>
              Update User
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Current Users</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {profiles.map((profile) => (
                <div key={profile.id} className="p-3 border rounded space-y-1">
                  <div className="font-medium">{profile.name}</div>
                  <div className="text-sm text-muted-foreground">{profile.user_id}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'}>
                      {profile.role}
                    </Badge>
                    {profile.shop_id && (
                      <Badge variant="outline">
                        {shops.find(s => s.id === profile.shop_id)?.name || 'Unknown Shop'}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
