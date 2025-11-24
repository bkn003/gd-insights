import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2, RotateCcw } from 'lucide-react';
import { Database } from '@/types/database';

type CustomerType = Database['public']['Tables']['customer_types']['Row'];

interface CustomerTypeManagementProps {
  customerTypes: CustomerType[];
  onRefresh: () => void;
}

export const CustomerTypeManagement = ({ customerTypes, onRefresh }: CustomerTypeManagementProps) => {
  const [newCustomerType, setNewCustomerType] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!newCustomerType.trim()) {
      toast.error('Please enter a customer type name');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('customer_types')
        .insert({ name: newCustomerType.trim() });

      if (error) throw error;

      toast.success('Customer type added successfully');
      setNewCustomerType('');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add customer type');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('customer_types')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast.success('Customer type deleted successfully');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete customer type');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('customer_types')
        .update({ deleted_at: null })
        .eq('id', id);

      if (error) throw error;

      toast.success('Customer type restored successfully');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to restore customer type');
    } finally {
      setLoading(false);
    }
  };

  const activeCustomerTypes = customerTypes.filter(ct => !ct.deleted_at);
  const deletedCustomerTypes = customerTypes.filter(ct => ct.deleted_at);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Types</CardTitle>
        <CardDescription>Manage customer type options</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="New customer type..."
            value={newCustomerType}
            onChange={(e) => setNewCustomerType(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={loading} size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Active Customer Types</h4>
          {activeCustomerTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No customer types yet</p>
          ) : (
            activeCustomerTypes.map((customerType) => (
              <div key={customerType.id} className="flex items-center justify-between p-2 border rounded">
                <span>{customerType.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(customerType.id)}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>

        {deletedCustomerTypes.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <h4 className="text-sm font-medium text-muted-foreground">Deleted Customer Types</h4>
            {deletedCustomerTypes.map((customerType) => (
              <div key={customerType.id} className="flex items-center justify-between p-2 border rounded bg-muted">
                <span className="text-muted-foreground">{customerType.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRestore(customerType.id)}
                  disabled={loading}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
