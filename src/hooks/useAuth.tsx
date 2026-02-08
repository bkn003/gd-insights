
import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/types/database';
import { toast } from 'sonner';

type Profile = Database['public']['Tables']['profiles']['Row'];

const PROFILE_CACHE_KEY = 'user_profile';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user || null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          localStorage.removeItem(PROFILE_CACHE_KEY);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, retryCount = 0) => {
    try {
      // Check cache first
      const cachedProfileStr = localStorage.getItem(PROFILE_CACHE_KEY);
      const now = Date.now();

      if (cachedProfileStr) {
        const cachedProfile = JSON.parse(cachedProfileStr);
        if (now - cachedProfile.lastFetched < CACHE_DURATION && cachedProfile.id === userId) {
          setProfile(cachedProfile.data);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // Only sign out for critical auth errors, not transient errors
        if (error.message?.includes('JWT') || error.message?.includes('unauthorized') || error.code === 'PGRST301') {
          console.error('Auth error fetching profile, signing out:', error);
          await signOut();
          return;
        }
        
        // For other errors (like RLS issues during setup), retry a few times
        if (retryCount < 3) {
          console.log(`Profile fetch attempt ${retryCount + 1} failed, retrying...`, error);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return fetchProfile(userId, retryCount + 1);
        }
        
        console.error('Error fetching profile after retries:', error);
        throw error;
      }

      // Check if profile is soft-deleted
      if (data.deleted_at) {
        console.log('User profile is soft-deleted, signing out...');
        await signOut();
        return;
      }

      // Check if user account is paused
      const profileData = data as any;
      if (profileData.status === 'paused') {
        console.log('User account is paused, signing out...');
        toast.error('Your account has been paused. Please contact the administrator.');
        await signOut();
        return;
      }

      // For sub-users, check if their admin is also active
      if (profileData.role !== 'admin' && profileData.role !== 'super_admin' && profileData.admin_id) {
        const { data: adminData } = await supabase
          .from('profiles')
          .select('status, deleted_at')
          .eq('id', profileData.admin_id)
          .single();
        
        if (adminData && (adminData as any).status === 'paused') {
          console.log('Admin account is paused, signing out sub-user...');
          toast.error('Your organization has been paused. Please contact the administrator.');
          await signOut();
          return;
        }
      }

      // Update last_login_at
      await supabase
        .from('profiles')
        .update({ last_login_at: new Date().toISOString() } as any)
        .eq('id', userId);

      // Cache the profile
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
        data,
        lastFetched: now,
        id: userId
      }));

      setProfile(data as Profile);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      if (error?.message?.includes('JWT') || error?.message?.includes('unauthorized')) {
        await signOut();
      }
    } finally {
      setLoading(false);
    }
  };

  // Check user status less frequently - only every 5 minutes
  const checkUserStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('deleted_at, status')
        .eq('id', user.id)
        .single();

      const profileData = data as any;
      if (error || !data || profileData.deleted_at || profileData.status === 'paused') {
        console.log('User has been deleted or paused, forcing logout...');
        await signOut();
      }
    } catch (error: any) {
      console.error('Error checking user status:', error);
      if (error.message?.includes('JWT') || error.message?.includes('unauthorized')) {
        await signOut();
      }
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signOut = async () => {
    localStorage.removeItem(PROFILE_CACHE_KEY);
    localStorage.removeItem('gd_app_data');
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const resetPassword = async (email: string) => {
    const productionUrl = 'https://gd-tracking.vercel.app';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${productionUrl}/reset-password`,
    });
    return { error };
  };

  const refreshProfile = async () => {
    if (!user) return;
    localStorage.removeItem(PROFILE_CACHE_KEY);
    await fetchProfile(user.id);
  };

  return {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    refreshProfile,
    checkUserStatus,
    isSuperAdmin: profile?.role === 'super_admin',
    isAdmin: profile?.role === 'admin',
    isManager: profile?.role === 'manager',
    userShopId: profile?.shop_id,
    adminId: profile?.admin_id,
  };
};
