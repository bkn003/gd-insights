
import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/types/database';

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

  const fetchProfile = async (userId: string) => {
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

      if (error) throw error;

      // Check if profile is soft-deleted
      if (data.deleted_at) {
        console.log('User profile is soft-deleted, signing out...');
        await signOut();
        return;
      }

      // Cache the profile
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
        data,
        lastFetched: now,
        id: userId
      }));

      setProfile(data as Profile);
    } catch (error) {
      console.error('Error fetching profile:', error);
      await signOut();
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
        .select('deleted_at')
        .eq('id', user.id)
        .single();

      if (error || !data || data.deleted_at) {
        console.log('User has been deleted, forcing logout...');
        await signOut();
      }
    } catch (error) {
      console.error('Error checking user status:', error);
      // Only sign out if it's a critical error, not network issues
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const refreshProfile = async () => {
    if (!user) return;
    // Clear cache and force refetch
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
    isAdmin: profile?.role === 'admin',
    isManager: profile?.role === 'manager',
    userShopId: profile?.shop_id,
  };
};
