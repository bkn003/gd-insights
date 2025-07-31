
import { useAuth } from '@/hooks/useAuth';
import { AuthForm } from '@/components/AuthForm';
import { MainApp } from '@/components/MainApp';

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Only show MainApp (with navigation) when user is authenticated
  // AuthForm handles its own layout and doesn't show navigation
  return user ? <MainApp /> : <AuthForm />;
};

export default Index;
