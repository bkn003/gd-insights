import { useState, useEffect } from 'react';
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
}

const DEFAULT_VISIBILITY: FieldVisibility = {
  category: true,
  size: true,
  customer_type: true,
};

export const FieldVisibilitySettings = () => {
  const { profile } = useAuth();
  const [visibility, setVisibility] = useState<FieldVisibility>(DEFAULT_VISIBILITY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'field_visibility')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const value = data.value as Record<string, boolean>;
        setVisibility({
          category: value.category ?? true,
          size: value.size ?? true,
          customer_type: value.customer_type ?? true,
        });
      }
    } catch (error) {
      console.error('Error fetching field visibility:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (field: keyof FieldVisibility, newValue: boolean) => {
    const updated = { ...visibility, [field]: newValue };
    setVisibility(updated);

    try {
      const { error } = await (supabase.from('app_settings') as any).upsert(
        {
          key: 'field_visibility',
          value: updated,
          admin_id: (profile as any)?.admin_id || profile?.id,
        },
        { onConflict: 'key' }
      );

      if (error) throw error;
      toast.success(`${field.replace('_', ' ')} field ${newValue ? 'shown' : 'hidden'} in GD form`);
    } catch (error: any) {
      setVisibility({ ...visibility });
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
