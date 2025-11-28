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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { WhatsAppImageUpload } from '@/components/WhatsAppImageUpload';
import { VoiceMicButton } from '@/components/VoiceMicButton';
import { toast } from 'sonner';
import { Database } from '@/types/database';
type CustomerType = Database['public']['Tables']['customer_types']['Row'];
export const DamagedGoodsForm = () => {
  const {
    profile
  } = useAuth();
  const {
    categories,
    sizes,
    shops,
    loading: dataLoading
  } = useCachedData();
  const [loading, setLoading] = useState(false);
  const [userShop, setUserShop] = useState<any>(null);
  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [reporterName, setReporterName] = useState('');
  const [formData, setFormData] = useState({
    category_id: 'none',
    size_id: 'none',
    shop_id: profile?.shop_id || 'none',
    customer_type_id: '',
    notes: ''
  });
  useEffect(() => {
    const fetchCustomerTypes = async () => {
      const {
        data
      } = await supabase.from('customer_types').select('*').is('deleted_at', null).order('name');
      if (data) setCustomerTypes(data);
    };
    fetchCustomerTypes();
  }, []);
  useEffect(() => {
    if (profile?.shop_id) {
      setFormData(prev => ({
        ...prev,
        shop_id: profile.shop_id || 'none',
        category_id: prev.category_id !== 'none' ? prev.category_id : (profile as any).default_category_id || 'none',
        size_id: prev.size_id !== 'none' ? prev.size_id : (profile as any).default_size_id || 'none'
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
  const uploadImages = async (entryId: string) => {
    if (selectedImages.length === 0) return;
    const uploadPromises = selectedImages.map(async (file, index) => {
      const fileName = `${entryId}/${Date.now()}-${index}-${file.name}`;
      const {
        data,
        error
      } = await supabase.storage.from('gd-entry-images').upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });
      if (error) throw error;

      // Get public URL
      const {
        data: {
          publicUrl
        }
      } = supabase.storage.from('gd-entry-images').getPublicUrl(data.path);

      // Save image record to database
      const {
        error: dbError
      } = await supabase.from('gd_entry_images').insert({
        gd_entry_id: entryId,
        image_url: publicUrl,
        image_name: file.name,
        file_size: file.size
      });
      if (dbError) throw dbError;
      return publicUrl;
    });
    await Promise.all(uploadPromises);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (formData.category_id === 'none' || formData.size_id === 'none' || formData.shop_id === 'none' || !formData.customer_type_id || !formData.notes.trim()) {
      toast.error('Please fill in all required fields including customer type');
      return;
    }
    setLoading(true);
    try {
      // Create the GD entry first
      const {
        data: entryData,
        error: entryError
      } = await supabase.from('goods_damaged_entries').insert({
        category_id: formData.category_id,
        size_id: formData.size_id,
        shop_id: formData.shop_id,
        customer_type_id: formData.customer_type_id,
        employee_id: profile.id,
        employee_name: profile.name,
        notes: formData.notes.trim()
      }).select().single();
      if (entryError) throw entryError;

      // Upload images if any
      if (selectedImages.length > 0) {
        await uploadImages(entryData.id);
        toast.success(`GD entry created with ${selectedImages.length} image(s)!`);
      } else {
        toast.success('GD entry created successfully!');
      }

      // Send notification to service worker for admin users
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'NEW_GD_ENTRY',
          title: 'New GD Entry',
          body: `${profile.name} reported GD in ${userShop?.name || 'a shop'}`,
          url: '/'
        });
      }

      // Reset form
      setFormData({
        category_id: (profile as any)?.default_category_id || 'none',
        size_id: (profile as any)?.default_size_id || 'none',
        shop_id: profile?.shop_id || 'none',
        customer_type_id: '',
        notes: ''
      });
      setSelectedImages([]);

      // Refocus notes input after successful submission
      setTimeout(() => {
        const notesInput = document.querySelector('textarea#notes') as HTMLTextAreaElement;
        if (notesInput) {
          notesInput.focus();
        }
      }, 100);
    } catch (error: any) {
      console.error('Error creating entry:', error);
      toast.error(error.message || 'Failed to create entry');
    } finally {
      setLoading(false);
    }
  };
  const handleInputChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };
  if (dataLoading) {
    return <div className="flex justify-center items-center h-64">Loading form data...</div>;
  }
  return <Card className="w-full max-w-2xl mx-auto">
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
              <Select value={formData.category_id} onValueChange={value => handleInputChange('category_id', value)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select a category</SelectItem>
                  {categories.map(category => <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="size">Size *</Label>
              <Select value={formData.size_id} onValueChange={value => handleInputChange('size_id', value)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select a size</SelectItem>
                  {sizes.map(size => <SelectItem key={size.id} value={size.id}>
                      {size.size}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shop">Shop *</Label>
            <Input value={userShop?.name || (profile?.shop_id ? 'Loading shop...' : 'No shop assigned')} disabled className="bg-gray-100 cursor-not-allowed" />
            <p className="text-sm text-muted-foreground">
              Shop is automatically assigned based on your profile
            </p>
          </div>

          <div className="space-y-3">
            <Label>Type of Customer *</Label>
            <RadioGroup value={formData.customer_type_id} onValueChange={value => handleInputChange('customer_type_id', value)} required>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {customerTypes.map(type => <div key={type.id} className="flex items-center space-x-2 border rounded-md p-3 hover:bg-accent cursor-pointer">
                    <RadioGroupItem value={type.id} id={type.id} />
                    <Label htmlFor={type.id} className="cursor-pointer flex-1">{type.name}</Label>
                  </div>)}
              </div>
            </RadioGroup>
            {customerTypes.length === 0 && <p className="text-sm text-muted-foreground">No customer types available. Please contact admin.</p>}
          </div>

          

          <div className="space-y-2">
            <Label htmlFor="notes">Notes *</Label>
            <div className="flex gap-2 items-start">
              <Textarea id="notes" placeholder="Describe additional details" value={formData.notes} onChange={e => handleInputChange('notes', e.target.value)} required rows={4} autoFocus className="flex-1" />
              <VoiceMicButton language="ta-IN" mode="append" value={formData.notes} onChange={newValue => handleInputChange('notes', newValue)} />
            </div>
            <p className="text-sm text-muted-foreground">Use mic for Tamil voice input</p>
          </div>

          <div className="space-y-2">
            <Label>Images (Optional)</Label>
            <WhatsAppImageUpload onImagesChange={setSelectedImages} maxImages={10} />
            <p className="text-sm text-muted-foreground">Add photos to help document the damage. Each image will be compressed to ≤50KB automatically.</p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Report'}
          </Button>
        </form>
      </CardContent>
    </Card>;
};