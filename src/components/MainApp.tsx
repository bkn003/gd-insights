
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/components/Dashboard';
import { DamagedGoodsForm } from '@/components/DamagedGoodsForm';
import { AdminPanel } from '@/components/AdminPanel';
import { Button } from '@/components/ui/button';
import { BarChart3, Plus, Settings } from 'lucide-react';

type ActiveTab = 'dashboard' | 'form' | 'admin';

export const MainApp = () => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'form':
        return <DamagedGoodsForm />;
      case 'admin':
        return isAdmin ? <AdminPanel /> : <div>Access denied</div>;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex gap-2 border-b">
          <Button
            variant={activeTab === 'dashboard' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </Button>
          <Button
            variant={activeTab === 'form' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('form')}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Report Damage
          </Button>
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
