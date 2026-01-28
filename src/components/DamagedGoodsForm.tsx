import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useCachedData } from '@/hooks/useCachedData';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { WhatsAppInputBar } from '@/components/WhatsAppInputBar';
import { toast } from 'sonner';
import { Database } from '@/types/database';
import { sanitizeNotes, isValidUUID } from '@/utils/security';

type CustomerType = Database['public']['Tables']['customer_types']['Row'];

export const DamagedGoodsForm = () => {
  const { profile } = useAuth();
  const { categories, sizes, shops, loading: dataLoading } = useCachedData();
  const { isOnline, pendingCount, saveOfflineEntry } = useOfflineSync();
  const queryClient = useQueryClient();
  
  const [loading, setLoading] = useState(false);
  const [userShop, setUserShop] = useState<any>(null);
  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [voiceNoteFile, setVoiceNoteFile] = useState<File | null>(null);
  const [whatsappRedirectEnabled, setWhatsappRedirectEnabled] = useState(false);
  const [notes, setNotes] = useState('');
  
  const [formData, setFormData] = useState({
    category_id: 'none',
    size_id: 'none',
    shop_id: profile?.shop_id || 'none',
    customer_type_id: ''
  });

  // Fetch WhatsApp redirect setting
  const fetchWhatsAppSetting = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'whatsapp_redirect_enabled')
        .single();
      
      if (data) {
        const value = data.value as { enabled?: boolean };
        setWhatsappRedirectEnabled(value.enabled ?? false);
      }
    } catch (error) {
      console.error('Error fetching WhatsApp setting:', error);
    }
  }, []);

  useEffect(() => {
    const fetchCustomerTypes = async () => {
      const { data } = await supabase.from('customer_types').select('*').is('deleted_at', null).order('name');
      if (data) setCustomerTypes(data);
    };
    fetchCustomerTypes();
    fetchWhatsAppSetting();
  }, [fetchWhatsAppSetting]);

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

  const uploadVoiceNote = async (entryId: string): Promise<string | null> => {
    if (!voiceNoteFile) return null;

    const fileName = `${entryId}/${Date.now()}-${voiceNoteFile.name}`;
    const { data, error } = await supabase.storage
      .from('gd-voice-notes')
      .upload(fileName, voiceNoteFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('gd-voice-notes')
      .getPublicUrl(data.path);

    return publicUrl;
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    // Validation: Notes OR Voice Note is required
    const hasNotes = notes.trim().length > 0;
    const hasVoiceNote = voiceNoteFile !== null;

    if (formData.category_id === 'none' || formData.size_id === 'none' || formData.shop_id === 'none' || !formData.customer_type_id) {
      toast.error('Please fill in all required fields including customer type');
      return;
    }

    // Validate UUIDs to prevent injection
    if (!isValidUUID(formData.category_id) || !isValidUUID(formData.size_id) || !isValidUUID(formData.shop_id) || (formData.customer_type_id && !isValidUUID(formData.customer_type_id))) {
      toast.error('Invalid form data. Please refresh and try again.');
      return;
    }

    if (!hasNotes && !hasVoiceNote) {
      toast.error('Please provide either Notes or Voice Note');
      return;
    }

    setLoading(true);

    const sanitizedNotes = sanitizeNotes(notes.trim(), 1000);

    const entryData = {
      category_id: formData.category_id,
      size_id: formData.size_id,
      shop_id: formData.shop_id,
      customer_type_id: formData.customer_type_id,
      employee_id: profile.id,
      employee_name: profile.name,
      notes: sanitizedNotes || 'Voice note attached'
    };

    try {
      // If offline, save to IndexedDB
      if (!isOnline) {
        const saved = await saveOfflineEntry(entryData, selectedImages);
        if (saved) {
          // Reset form
          setFormData({
            category_id: (profile as any)?.default_category_id || 'none',
            size_id: (profile as any)?.default_size_id || 'none',
            shop_id: profile?.shop_id || 'none',
            customer_type_id: ''
          });
          setNotes('');
          setSelectedImages([]);
          setVoiceNoteFile(null);

          // Refocus notes input
          setTimeout(() => {
            const notesInput = document.querySelector('textarea#notes') as HTMLTextAreaElement;
            if (notesInput) notesInput.focus();
          }, 100);
        }
        return;
      }

      // Online: Save directly to Supabase
      const { data: createdEntry, error: entryError } = await supabase
        .from('goods_damaged_entries')
        .insert(entryData)
        .select()
        .single();

      if (entryError) throw entryError;

      // Upload voice note if any
      let voiceNoteUrl: string | null = null;
      if (voiceNoteFile) {
        voiceNoteUrl = await uploadVoiceNote(createdEntry.id);
        if (voiceNoteUrl) {
          // Update entry with voice note URL
          await supabase
            .from('goods_damaged_entries')
            .update({ voice_note_url: voiceNoteUrl })
            .eq('id', createdEntry.id);
        }
      }

      // Upload images if any
      if (selectedImages.length > 0) {
        await uploadImages(createdEntry.id);
      }

      const successParts = [];
      if (selectedImages.length > 0) successParts.push(`${selectedImages.length} image(s)`);
      if (voiceNoteUrl) successParts.push('voice note');

      if (successParts.length > 0) {
        toast.success(`GD entry created with ${successParts.join(' and ')}!`);
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

      // Invalidate relevant queries to refresh Dashboard and Reports
      await queryClient.invalidateQueries({ queryKey: ['dashboard-entries'] });
      await queryClient.invalidateQueries({ queryKey: ['reports-data'] });

      // Reset form
      setFormData({
        category_id: (profile as any)?.default_category_id || 'none',
        size_id: (profile as any)?.default_size_id || 'none',
        shop_id: profile?.shop_id || 'none',
        customer_type_id: ''
      });
      setNotes('');
      setSelectedImages([]);
      setVoiceNoteFile(null);

      // WhatsApp redirect if enabled and shop has a group link
      if (whatsappRedirectEnabled && userShop?.whatsapp_group_link) {
        toast.success('Redirecting to WhatsApp group...');
        setTimeout(() => {
          window.open(userShop.whatsapp_group_link, '_blank');
        }, 1000);
      }

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
      <CardTitle className="flex items-center justify-between">
        <span>Report GD</span>
        <div className="flex items-center gap-2 text-sm font-normal">
          {!isOnline && (
            <span className="text-orange-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
              Offline Mode
            </span>
          )}
          {pendingCount > 0 && (
            <span className="text-blue-500">
              {pendingCount} pending
            </span>
          )}
        </div>
      </CardTitle>
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
          <Label>Notes / Voice / Images {!voiceNoteFile && !notes.trim() && '*'}</Label>
          <WhatsAppInputBar
            notes={notes}
            onNotesChange={setNotes}
            onImagesChange={setSelectedImages}
            onVoiceNoteChange={setVoiceNoteFile}
            voiceNoteFile={voiceNoteFile}
            maxImages={10}
            disabled={loading}
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Report'}
        </Button>
      </form>
    </CardContent>
  </Card>;
};