import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { UserPlus, Edit, Trash2 } from 'lucide-react';
import { Database } from '@/types/database';

type Profile = Database['public']['Tables']['profiles']['Row'] & {
  email?: string;
};
type Shop = Database['public']['Tables']['shops']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type Size = Database['public']['Tables']['sizes']['Row'];

interface UserManagementProps {
  shops?: Shop[];
  profiles?: Profile[];
  onRefresh?: () => void;
}

export const UserManagement = ({ shops: propShops, profiles: propProfiles, onRefresh: propOnRefresh }: UserManagementProps = {}) => {
  const { user, refreshProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>(propProfiles || []);
  const [shops, setShops] = useState<Shop[]>(propShops || []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [loading, setLoading] = useState(!propProfiles || !propShops);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    if (!propProfiles || !propShops) {
      fetchData();
    } else {
      // Still need to fetch categories and sizes even if profiles and shops are provided
      fetchCategoriesAndSizes();
    }
  }, [propProfiles, propShops]);

  const fetchCategoriesAndSizes = async () => {
    try {
      const [categoriesRes, sizesRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('sizes').select('*').order('size'),
      ]);

      if (categoriesRes.error) {
        console.error('Error fetching categories:', categoriesRes.error);
        throw categoriesRes.error;
      }
      if (sizesRes.error) {
        console.error('Error fetching sizes:', sizesRes.error);
        throw sizesRes.error;
      }

      setCategories(categoriesRes.data);
      setSizes(sizesRes.data);
    } catch (error) {
      console.error('Error fetching categories and sizes:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('name');

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }

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

      const typedProfiles = profilesData.map(profile => ({
        ...profile,
        role: profile.role as 'admin' | 'user' | 'manager'
      }));

      setProfiles(typedProfiles);
      setShops(shopsRes.data);
      setCategories(categoriesRes.data);
      setSizes(sizesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load user management data');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('User deleted successfully');
      if (propOnRefresh) {
        propOnRefresh();
      } else {
        fetchData();
      }
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Failed to delete user');
    }
  };

  const handleEditUser = (user: Profile) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  };

  const handleSaveUser = async (userData: Partial<Profile>) => {
    if (!editingUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update(userData)
        .eq('id', editingUser.id);

      if (error) throw error;

      toast.success('User updated successfully');

      // If the updated user is the current user, refresh their profile immediately
      if (user && editingUser.id === user.id) {
        await refreshProfile();
      }

      setIsEditDialogOpen(false);
      setEditingUser(null);
      if (propOnRefresh) {
        propOnRefresh();
      } else {
        fetchData();
      }
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(error.message || 'Failed to update user');
    }
  };

  const handleCancelEdit = () => {
    setIsEditDialogOpen(false);
    setEditingUser(null);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading user data...</div>;
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>
              Manage users and their roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {profiles.map((user) => (
                <div key={user.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {user.email || user.user_id}
                      </div>
                      <div className="mt-1">
                        <Badge variant="secondary">{user.role}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                            className="p-2"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit user</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(user.id)}
                            className="p-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete user</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user information and assignments
              </DialogDescription>
            </DialogHeader>

            {editingUser && (
              <EditUserForm
                user={editingUser}
                shops={shops}
                categories={categories}
                sizes={sizes}
                onSave={handleSaveUser}
                onCancel={handleCancelEdit}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

interface EditUserFormProps {
  user: Profile;
  shops: Shop[];
  categories: Category[];
  sizes: Size[];
  onSave: (userData: Partial<Profile>) => void;
  onCancel: () => void;
}

const EditUserForm = ({ user, shops, categories, sizes, onSave, onCancel }: EditUserFormProps) => {
  const [formData, setFormData] = useState({
    name: user.name,
    role: user.role,
    shop_id: user.shop_id || 'none',
    default_category_id: user.default_category_id || 'none',
    default_size_id: user.default_size_id || 'none'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      shop_id: formData.shop_id === 'none' ? null : formData.shop_id,
      default_category_id: formData.default_category_id === 'none' ? null : formData.default_category_id,
      default_size_id: formData.default_size_id === 'none' ? null : formData.default_size_id
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select
          value={formData.role}
          onValueChange={(value: 'admin' | 'user' | 'manager') => setFormData({ ...formData, role: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="shop">Shop</Label>
        <Select
          value={formData.shop_id}
          onValueChange={(value) => setFormData({ ...formData, shop_id: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a shop" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Shop</SelectItem>
            {shops.map((shop) => (
              <SelectItem key={shop.id} value={shop.id}>
                {shop.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="default_category">Default Category</Label>
        <Select
          value={formData.default_category_id}
          onValueChange={(value) => setFormData({ ...formData, default_category_id: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Default Category</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="default_size">Default Size</Label>
        <Select
          value={formData.default_size_id}
          onValueChange={(value) => setFormData({ ...formData, default_size_id: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Default Size</SelectItem>
            {sizes.map((size) => (
              <SelectItem key={size.id} value={size.id}>
                {size.size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" className="flex-1">
          Save Changes
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};
