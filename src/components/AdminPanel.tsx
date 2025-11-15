
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Database } from '@/types/database';
import { ShopManagement } from '@/components/admin/ShopManagement';
import { CategoryManagement } from '@/components/admin/CategoryManagement';
import { SizeManagement } from '@/components/admin/SizeManagement';
import { UserManagement } from '@/components/admin/UserManagement';

type Shop = Database['public']['Tables']['shops']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type Size = Database['public']['Tables']['sizes']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

export const AdminPanel = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Clear cached data to ensure forms get fresh data
      localStorage.removeItem('gd_app_data');
      
      const [shopsRes, categoriesRes, sizesRes, profilesRes] = await Promise.all([
        supabase.from('shops').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('sizes').select('*').order('size'),
        supabase.from('profiles').select('*').is('deleted_at', null).order('name'),
      ]);

      if (shopsRes.error) throw shopsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (sizesRes.error) throw sizesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      setShops(shopsRes.data);
      setCategories(categoriesRes.data);
      setSizes(sizesRes.data);
      setProfiles(profilesRes.data as Profile[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading admin panel...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ShopManagement shops={shops} onRefresh={fetchData} />
        <CategoryManagement categories={categories} onRefresh={fetchData} />
        <SizeManagement sizes={sizes} onRefresh={fetchData} />
      </div>
      
      <UserManagement shops={shops} profiles={profiles} onRefresh={fetchData} />
    </div>
  );
};
