
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/components/Dashboard';
import { DamagedGoodsForm } from '@/components/DamagedGoodsForm';
import { AdminPanel } from '@/components/AdminPanel';
import { ReportsPanel } from '@/components/ReportsPanel';
import { UserProfile } from '@/components/UserProfile';
import { Button } from '@/components/ui/button';
import { BarChart3, Plus, Settings, FileText, User } from 'lucide-react';

type ActiveTab = 'gd' | 'dashboard' | 'admin' | 'reports' | 'profile';

export const MainApp = () => {
  const { isAdmin, profile, user } = useAuth();
  // Set initial tab based on user role: regular users start with GD, admins start with Dashboard
  const [activeTab, setActiveTab] = useState<ActiveTab>(isAdmin ? 'dashboard' : 'gd');

  // Update active tab when user role changes
  useEffect(() => {
    if (!isAdmin && activeTab !== 'gd') {
      setActiveTab('gd');
    }
  }, [isAdmin, activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'gd':
        return <DamagedGoodsForm />;
      case 'dashboard':
        return isAdmin ? <Dashboard /> : <div className="text-center text-muted-foreground">Access denied</div>;
      case 'admin':
        return isAdmin ? <AdminPanel /> : <div className="text-center text-muted-foreground">Access denied</div>;
      case 'reports':
        return isAdmin ? <ReportsPanel /> : <div className="text-center text-muted-foreground">Access denied</div>;
      case 'profile':
        return <UserProfile />;
      default:
        return <DamagedGoodsForm />;
    }
  };

  // Don't render navigation if user is not authenticated
  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2 border-b overflow-x-auto">
          <Button
            variant={activeTab === 'gd' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('gd')}
            className="flex items-center gap-2 flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
            GD
          </Button>
          <Button
            variant={activeTab === 'profile' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('profile')}
            className="flex items-center gap-2 flex-shrink-0"
          >
            <User className="h-4 w-4" />
            Profile
          </Button>
          {isAdmin && (
            <Button
              variant={activeTab === 'dashboard' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </Button>
          )}
          {isAdmin && (
            <Button
              variant={activeTab === 'reports' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('reports')}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <FileText className="h-4 w-4" />
              Reports
            </Button>
          )}
          {isAdmin && (
            <Button
              variant={activeTab === 'admin' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('admin')}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <Settings className="h-4 w-4" />
              Admin Panel
            </Button>
          )}
        </div>

        {renderContent()}
      </div>
    </Layout>
  );
};
