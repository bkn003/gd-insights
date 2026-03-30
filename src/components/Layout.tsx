import { ReactNode, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, Package } from 'lucide-react';
import { toast } from 'sonner';
import { NotificationBell } from './NotificationBell';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { profile, signOut, isSuperAdmin, isAdmin, isManager } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setLoggingOut(true);
    const { error } = await signOut();
    if (error) {
      toast.error('Error signing out');
    } else {
      toast.success('Signed out successfully');
    }
    setLoggingOut(false);
    setShowLogoutConfirm(false);
  };

  const getRoleBadge = () => {
    if (isSuperAdmin) return { label: 'Super Admin', className: 'bg-destructive text-destructive-foreground' };
    if (isAdmin) return { label: 'Admin', className: 'bg-primary text-primary-foreground' };
    if (isManager) return { label: 'Manager', className: 'bg-accent text-accent-foreground' };
    return null;
  };

  const roleBadge = getRoleBadge();

  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden">
      <nav className="border-b bg-card w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16 min-w-0">
            <div className="flex items-center min-w-0 flex-shrink-0">
              <Package className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
              <span className="ml-2 text-lg sm:text-xl font-bold text-foreground truncate">
                <span className="sm:hidden">GD</span>
                <span className="hidden sm:inline">GD Tracker</span>
              </span>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-shrink-0">
              <div className="flex items-center space-x-1 sm:space-x-2 min-w-0">
                <span className="text-xs sm:text-sm text-muted-foreground truncate max-w-20 sm:max-w-none">
                  {profile?.name}
                </span>
                {roleBadge && (
                  <span className={`px-1.5 py-0.5 sm:px-2 sm:py-1 text-xs rounded flex-shrink-0 ${roleBadge.className}`}>
                    {roleBadge.label}
                  </span>
                )}
              </div>
              
              <NotificationBell />
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLogoutConfirm(true)}
                className="flex items-center gap-1 sm:gap-2 flex-shrink-0"
              >
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="max-w-7xl mx-auto py-4 sm:py-6 px-3 sm:px-4 lg:px-8 w-full min-w-0">
        {children}
      </main>

      <DeleteConfirmationDialog
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        onConfirm={handleSignOut}
        title="Sign Out"
        description="Are you sure you want to sign out?"
        loading={loggingOut}
      />
    </div>
  );
};
