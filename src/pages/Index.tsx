
import { useAuth } from '@/hooks/useAuth';
import { AuthForm } from '@/components/AuthForm';
import { MainApp } from '@/components/MainApp';
import { EmailVerificationPending } from '@/components/EmailVerificationPending';

const Index = () => {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return <AuthForm />;

  // Check email verification - skip for sub-users created by admin (they won't have email_confirmed_at but are trusted)
  const isEmailVerified = user.email_confirmed_at != null;
  const isSubUser = user.app_metadata?.admin_id != null;
  
  if (!isEmailVerified && !isSubUser) {
    return <EmailVerificationPending email={user.email || ''} onSignOut={signOut} />;
  }

  return <MainApp />;
};

export default Index;
