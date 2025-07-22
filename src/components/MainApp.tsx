
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/components/Dashboard';
import { DamagedGoodsForm } from '@/components/DamagedGoodsForm';
import { AdminPanel } from '@/components/AdminPanel';
import { ReportsPanel } from '@/components/ReportsPanel';
import { Button } from '@/components/ui/button';
import { BarChart3, Plus, Settings, FileText } from 'lucide-react';

type ActiveTab = 'gd' | 'dashboard' | 'admin' | 'reports';

export const MainApp = () => {
  const { isAdmin, profile } = useAuth();
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
      default:
        return <DamagedGoodsForm />;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex gap-2 border-b">
          <Button
            variant={activeTab === 'gd' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('gd')}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            GD
          </Button>
          {isAdmin && (
            <Button
              variant={activeTab === 'dashboard' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </Button>
          )}
          {isAdmin && (
            <Button
              variant={activeTab === 'reports' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('reports')}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Reports
            </Button>
          )}
          {isAdmin && (
            <Button
              variant={activeTab === 'admin' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('admin')}
              className="flex items-center gap-2"
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
