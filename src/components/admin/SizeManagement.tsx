import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Ruler } from 'lucide-react';
import { Database } from '@/types/database';
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog';
import { useAuth } from '@/hooks/useAuth';

type Size = Database['public']['Tables']['sizes']['Row'];

interface SizeManagementProps {
  sizes: Size[];
  onRefresh: () => void;
}

export const SizeManagement = ({ sizes, onRefresh }: SizeManagementProps) => {
  const { profile } = useAuth();
  const [newSizeName, setNewSizeName] = useState('');
  const [editingSize, setEditingSize] = useState<Size | null>(null);
  const [editName, setEditName] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Size | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreateSize = async () => {
    if (!newSizeName.trim()) return;

    try {
      const { error } = await (supabase
        .from('sizes') as any)
        .insert({ size: newSizeName.trim(), admin_id: (profile as any)?.admin_id || profile?.id });

      if (error) throw error;

      toast.success('Size created successfully');
      setNewSizeName('');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create size');
    }
  };

  const handleEditSize = async () => {
    if (!editingSize || !editName.trim()) return;

    try {
      const { error } = await supabase
        .from('sizes')
        .update({ size: editName.trim() })
        .eq('id', editingSize.id);

      if (error) throw error;

      toast.success('Size updated successfully');
      closeEditDialog();
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update size');
    }
  };

  const handleDeleteSize = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('sizes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteItem.id);

      if (error) throw error;

      toast.success('Size deleted successfully');
      setDeleteItem(null);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete size');
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditDialog = (size: Size) => {
    setEditingSize(size);
    setEditName(size.size);
    setIsEditOpen(true);
  };

  const closeEditDialog = () => {
    setIsEditOpen(false);
    setEditingSize(null);
    setEditName('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ruler className="h-5 w-5" />
          Sizes Management
        </CardTitle>
        <CardDescription>Add and manage sizes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Size name"
            value={newSizeName}
            onChange={(e) => setNewSizeName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateSize()}
          />
          <Button onClick={handleCreateSize} disabled={!newSizeName.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {sizes.map((size) => (
            <div key={size.id} className="flex items-center justify-between p-2 border rounded">
              <span className="text-sm">{size.size}</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg border-2 border-primary/20 hover:border-primary hover:bg-primary/10"
                  onClick={() => openEditDialog(size)}
                >
                  <Edit className="h-4 w-4 text-primary" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg border-2 border-destructive/20 hover:border-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteItem(size)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        {/* Edit Dialog - controlled */}
        <Dialog open={isEditOpen} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Size</DialogTitle>
              <DialogDescription>Update the size name</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Size name"
                onKeyPress={(e) => e.key === 'Enter' && handleEditSize()}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={closeEditDialog}>
                  Cancel
                </Button>
                <Button onClick={handleEditSize} disabled={!editName.trim()}>
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          open={!!deleteItem}
          onOpenChange={(open) => !open && setDeleteItem(null)}
          onConfirm={handleDeleteSize}
          title="Delete Size"
          itemName={deleteItem?.size}
          loading={isDeleting}
        />
      </CardContent>
    </Card>
  );
};
