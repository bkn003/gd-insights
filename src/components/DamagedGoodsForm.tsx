
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Database } from '@/types/database';

type Category = Database['public']['Tables']['categories']['Row'];
type Size = Database['public']['Tables']['sizes']['Row'];
type Shop = Database['public']['Tables']['shops']['Row'];

export const DamagedGoodsForm = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [userShop, setUserShop] = useState<Shop | null>(null);
  const [formData, setFormData] = useState({
    category_id: '',
    size_id: '',
    shop_id: profile?.shop_id || '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (profile?.shop_id) {
      setFormData(prev => ({ 
        ...prev, 
        shop_id: profile.shop_id || '',
        // Pre-fill defaults from user profile
        category_id: prev.category_id || (profile as any).default_category_id || '',
        size_id: prev.size_id || (profile as any).default_size_id || ''
      }));
      // Find the user's shop for display
      if (shops.length > 0) {
        const shop = shops.find(s => s.id === profile.shop_id);
        if (shop) {
          setUserShop(shop);
        }
      }
    }
  }, [profile, shops]);

  const fetchData = async () => {
    try {
      const [categoriesRes, sizesRes, shopsRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('sizes').select('*').order('size'),
        supabase.from('shops').select('*').order('name'),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (sizesRes.error) throw sizesRes.error;
      if (shopsRes.error) throw shopsRes.error;

      setCategories(categoriesRes.data);
      setSizes(sizesRes.data);
      setShops(shopsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load form data');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    // Validate all required fields
    if (!formData.category_id || !formData.size_id || !formData.shop_id || !formData.notes.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('goods_damaged_entries')
        .insert({
          category_id: formData.category_id,
          size_id: formData.size_id,
          shop_id: formData.shop_id,
          employee_id: profile.id,
          employee_name: profile.name,
          notes: formData.notes.trim(),
        });

      if (error) throw error;

      toast.success('GD entry created successfully!');
      setFormData({
        category_id: (profile as any)?.default_category_id || '',
        size_id: (profile as any)?.default_size_id || '',
        shop_id: profile?.shop_id || '',
        notes: '',
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to create entry');
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
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Report GD</CardTitle>
        <CardDescription>
          Fill out this form to report GD in your store
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => handleInputChange('category_id', value)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="size">Size *</Label>
              <Select
                value={formData.size_id}
                onValueChange={(value) => handleInputChange('size_id', value)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a size" />
                </SelectTrigger>
                <SelectContent>
                  {sizes.map((size) => (
                    <SelectItem key={size.id} value={size.id}>
                      {size.size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shop">Shop *</Label>
            <Input
              value={userShop?.name || (profile?.shop_id ? 'Loading shop...' : 'No shop assigned')}
              disabled
              className="bg-gray-100 cursor-not-allowed"
            />
            <p className="text-sm text-muted-foreground">
              Shop is automatically assigned based on your profile
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes *</Label>
            <Textarea
              id="notes"
              placeholder="Describe the damage and any additional details..."
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              required
              rows={4}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Report'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
