import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Users, Edit, Trash2 } from 'lucide-react';
import { Database } from '@/types/database';

type Shop = Database['public']['Tables']['shops']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type Size = Database['public']['Tables']['sizes']['Row'];

interface UserManagementProps {
  shops: Shop[];
  profiles: Profile[];
  onRefresh: () => void;
}

export const UserManagement = ({ shops, profiles, onRefresh }: UserManagementProps) => {
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [editFormData, setEditFormData] = useState({
    role: 'user' as 'admin' | 'user',
    shopId: '',
    defaultCategoryId: '',
    defaultSizeId: '',
  });

  useEffect(() => {
    fetchCategoriesAndSizes();
  }, []);

  const fetchCategoriesAndSizes = async () => {
    try {
      const [categoriesRes, sizesRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('sizes').select('*').order('size'),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (sizesRes.error) throw sizesRes.error;

      setCategories(categoriesRes.data);
      setSizes(sizesRes.data);
    } catch (error) {
      console.error('Error fetching categories and sizes:', error);
    }
  };

  const handleEditUser = async () => {
    if (!editingUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          role: editFormData.role,
          shop_id: editFormData.shopId || null,
          default_category_id: editFormData.defaultCategoryId === 'none' ? null : editFormData.defaultCategoryId,
          default_size_id: editFormData.defaultSizeId === 'none' ? null : editFormData.defaultSizeId,
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      toast.success('User updated successfully');
      setEditingUser(null);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;

      toast.success('User deleted successfully');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
    }
  };

  const openEditDialog = (profile: Profile) => {
    setEditingUser(profile);
    setEditFormData({
      role: profile.role as 'admin' | 'user',
      shopId: profile.shop_id || '',
      defaultCategoryId: (profile as any).default_category_id || 'none',
      defaultSizeId: (profile as any).default_size_id || 'none',
    });
  };

  // Filter out soft-deleted users (those with deleted_at set)
  const activeProfiles = profiles.filter(profile => !profile.deleted_at);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          User Management
        </CardTitle>
        <CardDescription>Manage user roles and shop assignments</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <h4 className="font-medium">Current Users ({activeProfiles.length})</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {activeProfiles.map((profile) => (
              <div key={profile.id} className="p-3 border rounded space-y-2">
                <div className="font-medium">{profile.name}</div>
                <div className="text-sm text-muted-foreground">{profile.user_id}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'}>
                    {profile.role}
                  </Badge>
                  {profile.shop_id && (
                    <Badge variant="outline">
                      {shops.find(s => s.id === profile.shop_id)?.name || 'Unknown Shop'}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1 pt-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(profile)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>Update user role and shop assignment</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium">User: {editingUser?.name}</label>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Role</label>
                          <Select
                            value={editFormData.role}
                            onValueChange={(value) => setEditFormData({ ...editFormData, role: value as 'admin' | 'user' })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Shop</label>
                          <Select
                            value={editFormData.shopId}
                            onValueChange={(value) => setEditFormData({ ...editFormData, shopId: value })}
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
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Default Category</label>
                          <Select
                            value={editFormData.defaultCategoryId}
                            onValueChange={(value) => setEditFormData({ ...editFormData, defaultCategoryId: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select default category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No default</SelectItem>
                              {categories.map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Default Size</label>
                          <Select
                            value={editFormData.defaultSizeId}
                            onValueChange={(value) => setEditFormData({ ...editFormData, defaultSizeId: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select default size" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No default</SelectItem>
                              {sizes.map((size) => (
                                <SelectItem key={size.id} value={size.id}>
                                  {size.size}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" onClick={() => setEditingUser(null)}>
                            Cancel
                          </Button>
                          <Button onClick={handleEditUser}>
                            Save Changes
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteUser(profile.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
