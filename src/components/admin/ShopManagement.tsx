
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Building } from 'lucide-react';
import { Database } from '@/types/database';

type Shop = Database['public']['Tables']['shops']['Row'];

interface ShopManagementProps {
  shops: Shop[];
  onRefresh: () => void;
}

export const ShopManagement = ({ shops, onRefresh }: ShopManagementProps) => {
  const [newShopName, setNewShopName] = useState('');
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreateShop = async () => {
    if (!newShopName.trim()) return;

    try {
      const { error } = await supabase
        .from('shops')
        .insert({ name: newShopName.trim() });

      if (error) throw error;

      toast.success('Shop created successfully');
      setNewShopName('');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create shop');
    }
  };

  const handleEditShop = async () => {
    if (!editingShop || !editName.trim()) return;

    try {
      const { error } = await supabase
        .from('shops')
        .update({ name: editName.trim() })
        .eq('id', editingShop.id);

      if (error) throw error;

      toast.success('Shop updated successfully');
      setEditingShop(null);
      setEditName('');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update shop');
    }
  };

  const handleDeleteShop = async (id: string) => {
    try {
      const { error } = await supabase
        .from('shops')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Shop deleted successfully');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete shop');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Shops Management
        </CardTitle>
        <CardDescription>Add and manage shops</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Shop name"
            value={newShopName}
            onChange={(e) => setNewShopName(e.target.value)}
          />
          <Button onClick={handleCreateShop}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {shops.map((shop) => (
            <div key={shop.id} className="flex items-center justify-between p-2 border rounded">
              <span className="text-sm">{shop.name}</span>
              <div className="flex gap-1">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingShop(shop);
                        setEditName(shop.name);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Shop</DialogTitle>
                      <DialogDescription>Update the shop name</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Shop name"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setEditingShop(null)}>
                          Cancel
                        </Button>
                        <Button onClick={handleEditShop}>
                          Save
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteShop(shop.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
