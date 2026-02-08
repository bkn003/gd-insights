
import { Button } from '@/components/ui/button';
import { BarChart3, Plus, Settings, FileText, User, Shield } from 'lucide-react';

type ActiveTab = 'gd' | 'dashboard' | 'admin' | 'reports' | 'profile' | 'super_admin';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isAdmin: boolean;
  isManager?: boolean;
  isSuperAdmin?: boolean;
}

export const MobileBottomNav = ({ activeTab, setActiveTab, isAdmin, isManager, isSuperAdmin }: MobileBottomNavProps) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border">
      <div className="flex justify-around items-center py-2 px-4">
        {/* Super Admin tab */}
        {isSuperAdmin && (
          <Button
            variant={activeTab === 'super_admin' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('super_admin')}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3"
            size="sm"
          >
            <Shield className="h-4 w-4" />
            <span className="text-xs">SA</span>
          </Button>
        )}

        {/* GD tab - hidden for super admin */}
        {!isSuperAdmin && (
          <Button
            variant={activeTab === 'gd' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('gd')}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            <span className="text-xs">GD</span>
          </Button>
        )}

        {/* Profile button for admins and managers */}
        {(isAdmin || isManager || isSuperAdmin) && (
          <Button
            variant={activeTab === 'profile' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('profile')}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3"
            size="sm"
          >
            <User className="h-4 w-4" />
            <span className="text-xs">Profile</span>
          </Button>
        )}

        {(isAdmin || isManager || isSuperAdmin) && (
          <Button
            variant={activeTab === 'dashboard' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('dashboard')}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3"
            size="sm"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="text-xs">Dashboard</span>
          </Button>
        )}

        {(isAdmin || isManager || isSuperAdmin) && (
          <Button
            variant={activeTab === 'reports' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('reports')}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3"
            size="sm"
          >
            <FileText className="h-4 w-4" />
            <span className="text-xs">Reports</span>
          </Button>
        )}

        {(isAdmin || isSuperAdmin) && (
          <Button
            variant={activeTab === 'admin' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('admin')}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3"
            size="sm"
          >
            <Settings className="h-4 w-4" />
            <span className="text-xs">Admin</span>
          </Button>
        )}
      </div>
    </div>
  );
};
