
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Package } from 'lucide-react';
import { Database } from '@/types/database';

type Category = Database['public']['Tables']['categories']['Row'];

interface CategoryManagementProps {
  categories: Category[];
  onRefresh: () => void;
}

export const CategoryManagement = ({ categories, onRefresh }: CategoryManagementProps) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      const { error } = await supabase
        .from('categories')
        .insert({ name: newCategoryName.trim() });

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
      setEditingCategory(null);
      setEditName('');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast.success('Category deleted successfully');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete category');
    }
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
          />
          <Button onClick={handleCreateCategory}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center justify-between p-2 border rounded">
              <span className="text-sm">{category.name}</span>
              <div className="flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-lg border-2 border-primary/20 hover:border-primary hover:bg-primary/10"
                      onClick={() => {
                        setEditingCategory(category);
                        setEditName(category.name);
                      }}
                    >
                      <Edit className="h-4 w-4 text-primary" />
                    </Button>
                  </DialogTrigger>
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
                      />
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setEditingCategory(null)}>
                          Cancel
                        </Button>
                        <Button onClick={handleEditCategory}>
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
                  onClick={() => handleDeleteCategory(category.id)}
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
