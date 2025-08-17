
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCachedData } from '@/hooks/useCachedData';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export const DamagedGoodsForm = () => {
  const { profile } = useAuth();
  const { categories, sizes, shops, loading: dataLoading } = useCachedData();
  const [loading, setLoading] = useState(false);
  const [userShop, setUserShop] = useState<any>(null);
  const [formData, setFormData] = useState({
    category_id: '',
    size_id: '',
    shop_id: profile?.shop_id || '',
    notes: '',
  });

  useEffect(() => {
    if (profile?.shop_id) {
      setFormData(prev => ({ 
        ...prev, 
        shop_id: profile.shop_id || '',
        category_id: prev.category_id || (profile as any).default_category_id || '',
        size_id: prev.size_id || (profile as any).default_size_id || ''
      }));
      
      if (shops.length > 0) {
        const shop = shops.find(s => s.id === profile.shop_id);
        if (shop) {
          setUserShop(shop);
        }
      }
    }
  }, [profile, shops]);

  // Auto-focus notes input when component mounts or updates
  useEffect(() => {
    const notesInput = document.querySelector('textarea#notes') as HTMLTextAreaElement;
    if (notesInput && !dataLoading) {
      setTimeout(() => {
        notesInput.focus();
      }, 100);
    }
  }, [dataLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

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

      // Refocus notes input after successful submission
      setTimeout(() => {
        const notesInput = document.querySelector('textarea#notes') as HTMLTextAreaElement;
        if (notesInput) {
          notesInput.focus();
        }
      }, 100);
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

  if (dataLoading) {
    return <div className="flex justify-center items-center h-64">Loading form data...</div>;
  }

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
              placeholder="Describe additional details"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              required
              rows={4}
              autoFocus
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
