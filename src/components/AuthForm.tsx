

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Package } from 'lucide-react';
import { Database } from '@/types/database';

type Shop = Database['public']['Tables']['shops']['Row'];

export const AuthForm = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    shopId: 'none',
  });

  const { signIn, signUp, resetPassword } = useAuth();

  useEffect(() => {
    if (isSignUp) {
      fetchShops();
    }
  }, [isSignUp]);

  const fetchShops = async () => {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setShops(data);
    } catch (error) {
      console.error('Error fetching shops:', error);
      toast.error('Failed to load shops');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isForgotPassword) {
        if (!formData.email) {
          toast.error('Please enter your email');
          return;
        }
        const { error } = await resetPassword(formData.email);
        if (error) throw error;
        toast.success('Password reset email sent! Please check your inbox.');
        setIsForgotPassword(false);
        setFormData({ ...formData, email: '' });
      } else if (isSignUp) {
        if (formData.shopId === 'none') {
          toast.error('Please select a shop');
          return;
        }
        
        const { error } = await signUp(formData.email, formData.password, formData.name);
        if (error) throw error;
        
        toast.success('Account created successfully! Please check your email to verify your account.');
      } else {
        const { error } = await signIn(formData.email, formData.password);
        if (error) throw error;
        toast.success('Signed in successfully!');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">
            {isForgotPassword ? 'Reset Password' : isSignUp ? 'Create Account' : 'Sign In'}
          </CardTitle>
          <CardDescription className="text-center">
            {isForgotPassword
              ? 'Enter your email to receive a password reset link'
              : isSignUp
              ? 'Enter your information to create an account'
              : 'Enter your email and password to sign in'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && !isForgotPassword && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shop">Shop</Label>
                  <Select
                    value={formData.shopId}
                    onValueChange={(value) => setFormData({ ...formData, shopId: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your shop" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select your shop</SelectItem>
                      {shops.map((shop) => (
                        <SelectItem key={shop.id} value={shop.id}>
                          {shop.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
            {!isForgotPassword && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {!isSignUp && (
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-xs px-0 h-auto"
                    >
                      Forgot password?
                    </Button>
                  )}
                </div>
                <PasswordInput
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Loading...' : isForgotPassword ? 'Send Reset Link' : isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-4 text-center space-y-2">
            {isForgotPassword ? (
              <Button
                variant="link"
                onClick={() => {
                  setIsForgotPassword(false);
                  setFormData({ ...formData, email: '' });
                }}
                className="text-sm"
              >
                Back to sign in
              </Button>
            ) : (
              <Button
                variant="link"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm"
              >
                {isSignUp
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

