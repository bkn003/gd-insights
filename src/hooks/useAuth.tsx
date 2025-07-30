
import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

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
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
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
      
      // Cast the role to the expected type since we know it's valid
      setProfile(data as Profile);
    } catch (error) {
      console.error('Error fetching profile:', error);
      // If profile doesn't exist or other error, sign out the user
      await signOut();
    } finally {
      setLoading(false);
    }
  };

  // Function to check if current user is soft-deleted (can be called periodically)
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
      await signOut();
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
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    checkUserStatus,
    isAdmin: profile?.role === 'admin',
  };
};
