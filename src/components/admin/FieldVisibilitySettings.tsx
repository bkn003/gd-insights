import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface FieldVisibility {
  category: boolean;
  size: boolean;
  customer_type: boolean;
  shops: boolean;
}

const DEFAULT_VISIBILITY: FieldVisibility = {
  category: true,
  size: true,
  customer_type: true,
  shops: true,
};

export const FieldVisibilitySettings = () => {
  const { profile } = useAuth();
  const [visibility, setVisibility] = useState<FieldVisibility>(DEFAULT_VISIBILITY);
  const [loading, setLoading] = useState(true);
  const [settingId, setSettingId] = useState<string | null>(null);

  const adminId = (profile as any)?.role === 'admin' ? profile?.id : (profile as any)?.admin_id;

  const fetchSettings = useCallback(async () => {
    if (!adminId) return;
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'field_visibility')
        .eq('admin_id', adminId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettingId(data.id);
        const value = data.value as Record<string, boolean>;
        setVisibility({
          category: value.category ?? true,
          size: value.size ?? true,
          customer_type: value.customer_type ?? true,
          shops: value.shops ?? true,
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching field visibility:', error);
    } finally {
      setLoading(false);
    }
  }, [adminId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleToggle = async (field: keyof FieldVisibility, newValue: boolean) => {
    if (!adminId) return;
    const updated = { ...visibility, [field]: newValue };
    setVisibility(updated);

    try {
      if (settingId) {
        const { error } = await supabase
          .from('app_settings')
          .update({ value: updated as any, updated_at: new Date().toISOString() })
          .eq('id', settingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('app_settings')
          .insert({
            key: 'field_visibility',
            value: updated as any,
            admin_id: adminId,
          })
          .select()
          .single();
        if (error) throw error;
        if (data) setSettingId(data.id);
      }
      const label = field === 'customer_type' ? 'Customer Type' : field === 'shops' ? 'Shops' : field.charAt(0).toUpperCase() + field.slice(1);
      toast.success(`${label} ${newValue ? 'shown' : 'hidden'} in GD form`);
    } catch (error: any) {
      setVisibility(visibility);
      toast.error(error.message || 'Failed to update setting');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse h-24 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const fields: { key: keyof FieldVisibility; label: string; desc: string }[] = [
    { key: 'category', label: 'Category', desc: 'Show category selection in GD form' },
    { key: 'size', label: 'Size', desc: 'Show size selection in GD form' },
    { key: 'customer_type', label: 'Customer Type', desc: 'Show customer type selection in GD form' },
    { key: 'shops', label: 'Shops', desc: 'Show shop selection in GD form (otherwise auto-assigned)' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          GD Form Field Visibility
        </CardTitle>
        <CardDescription>
          Choose which standard fields appear in the GD entry form for your staff
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">{f.label}</Label>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
            <Switch
              checked={visibility[f.key]}
              onCheckedChange={(v) => handleToggle(f.key, v)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
