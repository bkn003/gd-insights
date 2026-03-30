import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  itemName?: string;
  loading?: boolean;
  confirmLabel?: string;
  confirmVariant?: 'destructive' | 'default';
}

export const DeleteConfirmationDialog = ({
  open,
  onOpenChange,
  onConfirm,
  title = 'Delete Item',
  description,
  itemName,
  loading = false,
  confirmLabel,
  confirmVariant = 'destructive',
}: DeleteConfirmationDialogProps) => {
  const defaultDescription = itemName
    ? `Are you sure you want to delete "${itemName}"? This action cannot be undone.`
    : 'Are you sure you want to delete this item? This action cannot be undone.';

  const defaultConfirmLabel = confirmLabel || (title.toLowerCase().includes('sign out') || title.toLowerCase().includes('log out') ? 'Sign Out' : 'Delete');
  const isDestructive = confirmVariant === 'destructive';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description || defaultDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className={isDestructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {loading ? 'Processing...' : defaultConfirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
