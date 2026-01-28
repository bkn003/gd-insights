import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Building, MessageCircle } from 'lucide-react';
import { Database } from '@/types/database';

type Shop = Database['public']['Tables']['shops']['Row'];

interface ShopManagementProps {
  shops: Shop[];
  onRefresh: () => void;
}

export const ShopManagement = ({ shops, onRefresh }: ShopManagementProps) => {
  const [newShopName, setNewShopName] = useState('');
  const [newWhatsAppLink, setNewWhatsAppLink] = useState('');
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [editName, setEditName] = useState('');
  const [editWhatsAppLink, setEditWhatsAppLink] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const handleCreateShop = async () => {
    if (!newShopName.trim()) return;

    try {
      const { error } = await supabase
        .from('shops')
        .insert({ 
          name: newShopName.trim(),
          whatsapp_group_link: newWhatsAppLink.trim() || null
        });

      if (error) throw error;

      toast.success('Shop created successfully');
      setNewShopName('');
      setNewWhatsAppLink('');
      setIsAddOpen(false);
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
        .update({ 
          name: editName.trim(),
          whatsapp_group_link: editWhatsAppLink.trim() || null
        })
        .eq('id', editingShop.id);

      if (error) throw error;

      toast.success('Shop updated successfully');
      closeEditDialog();
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update shop');
    }
  };

  const handleDeleteShop = async (id: string) => {
    try {
      const { error } = await supabase
        .from('shops')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast.success('Shop deleted successfully');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete shop');
    }
  };

  const openEditDialog = (shop: Shop) => {
    setEditingShop(shop);
    setEditName(shop.name);
    setEditWhatsAppLink((shop as any).whatsapp_group_link || '');
    setIsEditOpen(true);
  };

  const closeEditDialog = () => {
    setIsEditOpen(false);
    setEditingShop(null);
    setEditName('');
    setEditWhatsAppLink('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Shops Management
        </CardTitle>
        <CardDescription>Add and manage shops with WhatsApp group links</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Shop name"
            value={newShopName}
            onChange={(e) => setNewShopName(e.target.value)}
          />
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <Button onClick={() => setIsAddOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Shop</DialogTitle>
                <DialogDescription>Create a new shop with optional WhatsApp group link</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-shop-name">Shop Name</Label>
                  <Input
                    id="new-shop-name"
                    value={newShopName}
                    onChange={(e) => setNewShopName(e.target.value)}
                    placeholder="Enter shop name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-whatsapp-link" className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-green-600" />
                    WhatsApp Group Link
                  </Label>
                  <Input
                    id="new-whatsapp-link"
                    value={newWhatsAppLink}
                    onChange={(e) => setNewWhatsAppLink(e.target.value)}
                    placeholder="https://chat.whatsapp.com/..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste the WhatsApp group invite link for this shop
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => { setIsAddOpen(false); setNewShopName(''); setNewWhatsAppLink(''); }}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateShop} disabled={!newShopName.trim()}>
                    Add Shop
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {shops.map((shop) => (
            <div key={shop.id} className="flex items-center justify-between p-2 border rounded">
              <div className="flex items-center gap-2">
                <span className="text-sm">{shop.name}</span>
                {(shop as any).whatsapp_group_link && (
                  <MessageCircle className="h-3 w-3 text-green-600" />
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg border-2 border-primary/20 hover:border-primary hover:bg-primary/10"
                  onClick={() => openEditDialog(shop)}
                >
                  <Edit className="h-4 w-4 text-primary" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg border-2 border-destructive/20 hover:border-destructive hover:bg-destructive/10"
                  onClick={() => handleDeleteShop(shop.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        {/* Edit Dialog - controlled separately */}
        <Dialog open={isEditOpen} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Shop</DialogTitle>
              <DialogDescription>Update shop name and WhatsApp group link</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="shop-name">Shop Name</Label>
                <Input
                  id="shop-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Shop name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp-link" className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-green-600" />
                  WhatsApp Group Link
                </Label>
                <Input
                  id="whatsapp-link"
                  value={editWhatsAppLink}
                  onChange={(e) => setEditWhatsAppLink(e.target.value)}
                  placeholder="https://chat.whatsapp.com/..."
                />
                <p className="text-xs text-muted-foreground">
                  Paste the WhatsApp group invite link for this shop
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={closeEditDialog}>
                  Cancel
                </Button>
                <Button onClick={handleEditShop}>
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
