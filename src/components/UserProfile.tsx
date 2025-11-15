
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Database } from '@/types/database';

type Category = Database['public']['Tables']['categories']['Row'];
type Size = Database['public']['Tables']['sizes']['Row'];

export const UserProfile = () => {
  const { profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [formData, setFormData] = useState({
    default_category_id: '',
    default_size_id: '',
  });

  useEffect(() => {
    fetchData();
    if (profile) {
      setFormData({
        default_category_id: (profile as any).default_category_id || '',
        default_size_id: (profile as any).default_size_id || '',
      });
    }
  }, [profile]);

  const fetchData = async () => {
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
      console.error('Error fetching data:', error);
      toast.error('Failed to load form data');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          default_category_id: formData.default_category_id === 'none' ? null : formData.default_category_id,
          default_size_id: formData.default_size_id === 'none' ? null : formData.default_size_id,
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast.success('Profile settings updated successfully!');
      
      // Refresh the profile to reflect changes immediately
      await refreshProfile();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      [field]: value,
    });
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>
          Set your default category and size preferences for faster GD reporting
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="default_category">Default Category</Label>
            <Select
              value={formData.default_category_id || 'none'}
              onValueChange={(value) => handleInputChange('default_category_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a default category" />
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
            <Label htmlFor="default_size">Default Size</Label>
            <Select
              value={formData.default_size_id || 'none'}
              onValueChange={(value) => handleInputChange('default_size_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a default size" />
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

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Updating...' : 'Update Settings'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
