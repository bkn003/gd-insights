
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Database } from '@/types/database';

type Size = Database['public']['Tables']['sizes']['Row'];

interface SizeManagementProps {
  sizes: Size[];
  onRefresh: () => void;
}

export const SizeManagement = ({ sizes, onRefresh }: SizeManagementProps) => {
  const [newSizeName, setNewSizeName] = useState('');
  const [editingSize, setEditingSize] = useState<Size | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreateSize = async () => {
    if (!newSizeName.trim()) return;

    try {
      const { error } = await supabase
        .from('sizes')
        .insert({ size: newSizeName.trim() });

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
      setEditingSize(null);
      setEditName('');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update size');
    }
  };

  const handleDeleteSize = async (id: string) => {
    try {
      const { error } = await supabase
        .from('sizes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast.success('Size deleted successfully');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete size');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sizes Management</CardTitle>
        <CardDescription>Add and manage sizes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Size name"
            value={newSizeName}
            onChange={(e) => setNewSizeName(e.target.value)}
          />
          <Button onClick={handleCreateSize}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {sizes.map((size) => (
            <div key={size.id} className="flex items-center justify-between p-2 border rounded">
              <span className="text-sm">{size.size}</span>
              <div className="flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-lg border-2 border-primary/20 hover:border-primary hover:bg-primary/10"
                      onClick={() => {
                        setEditingSize(size);
                        setEditName(size.size);
                      }}
                    >
                      <Edit className="h-4 w-4 text-primary" />
                    </Button>
                  </DialogTrigger>
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
                      />
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setEditingSize(null)}>
                          Cancel
                        </Button>
                        <Button onClick={handleEditSize}>
                          Save
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg border-2 border-destructive/20 hover:border-destructive hover:bg-destructive/10"
                  onClick={() => handleDeleteSize(size.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
