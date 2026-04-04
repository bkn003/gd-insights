
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MailCheck, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

interface EmailVerificationPendingProps {
  email: string;
  onSignOut: () => void;
}

export const EmailVerificationPending = ({ email, onSignOut }: EmailVerificationPendingProps) => {
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) throw error;
      toast.success('Verification email resent! Check your inbox.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend verification email');
    } finally {
      setResending(false);
    }
  };

  const handleRefresh = async () => {
    const { data } = await supabase.auth.refreshSession();
    if (data?.user?.email_confirmed_at) {
      window.location.reload();
    } else {
      toast.info('Email not yet verified. Please check your inbox.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <MailCheck className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">Verify Your Email</CardTitle>
          <CardDescription className="text-center">
            We sent a verification link to <strong>{email}</strong>. Please check your inbox and click the link to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Didn't receive the email?</strong> Check your spam folder or click below to resend.
            </p>
          </div>
          <Button onClick={handleResend} variant="outline" className="w-full" disabled={resending}>
            {resending ? 'Sending...' : 'Resend Verification Email'}
          </Button>
          <Button onClick={handleRefresh} className="w-full flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4" />
            I've Verified — Continue
          </Button>
          <Button variant="link" className="w-full" onClick={onSignOut}>
            Sign out and use a different account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
