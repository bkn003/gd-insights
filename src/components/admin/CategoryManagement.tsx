import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Package } from 'lucide-react';
import { Database } from '@/types/database';
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog';
import { useAuth } from '@/hooks/useAuth';

type Category = Database['public']['Tables']['categories']['Row'];

interface CategoryManagementProps {
  categories: Category[];
  onRefresh: () => void;
}

export const CategoryManagement = ({ categories, onRefresh }: CategoryManagementProps) => {
  const { profile } = useAuth();
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      const { error } = await (supabase
        .from('categories') as any)
        .insert({ name: newCategoryName.trim(), admin_id: (profile as any)?.admin_id || profile?.id });

      if (error) throw error;

      toast.success('Category created successfully');
      setNewCategoryName('');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create category');
    }
  };

  const handleEditCategory = async () => {
    if (!editingCategory || !editName.trim()) return;

    try {
      const { error } = await supabase
        .from('categories')
        .update({ name: editName.trim() })
        .eq('id', editingCategory.id);

      if (error) throw error;

      toast.success('Category updated successfully');
      closeEditDialog();
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update category');
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('categories')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteItem.id);

      if (error) throw error;

      toast.success('Category deleted successfully');
      setDeleteItem(null);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete category');
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setEditName(category.name);
    setIsEditOpen(true);
  };

  const closeEditDialog = () => {
    setIsEditOpen(false);
    setEditingCategory(null);
    setEditName('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Categories Management
        </CardTitle>
        <CardDescription>Add and manage categories</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateCategory()}
          />
          <Button onClick={handleCreateCategory} disabled={!newCategoryName.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center justify-between p-2 border rounded">
              <span className="text-sm">{category.name}</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg border-2 border-primary/20 hover:border-primary hover:bg-primary/10"
                  onClick={() => openEditDialog(category)}
                >
                  <Edit className="h-4 w-4 text-primary" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg border-2 border-destructive/20 hover:border-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteItem(category)}
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
              <DialogTitle>Edit Category</DialogTitle>
              <DialogDescription>Update the category name</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Category name"
                onKeyPress={(e) => e.key === 'Enter' && handleEditCategory()}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={closeEditDialog}>
                  Cancel
                </Button>
                <Button onClick={handleEditCategory} disabled={!editName.trim()}>
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
          onConfirm={handleDeleteCategory}
          title="Delete Category"
          itemName={deleteItem?.name}
          loading={isDeleting}
        />
      </CardContent>
    </Card>
  );
};
