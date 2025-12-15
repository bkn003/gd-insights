
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CachedData {
  categories: any[];
  sizes: any[];
  shops: any[];
  lastFetched: number;
}

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const CACHE_KEY = 'gd_app_data';

export const useCachedData = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Check cache first
      const cachedDataStr = localStorage.getItem(CACHE_KEY);
      const now = Date.now();

      if (cachedDataStr) {
        const cachedData: CachedData = JSON.parse(cachedDataStr);
        if (now - cachedData.lastFetched < CACHE_DURATION) {
          setCategories(cachedData.categories);
          setSizes(cachedData.sizes);
          setShops(cachedData.shops);
          setLoading(false);
          return;
        }
      }

      // Fetch from Supabase if cache is expired or doesn't exist
      const [categoriesRes, sizesRes, shopsRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('sizes').select('*').order('size'),
        supabase.from('shops').select('*').order('name'),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (sizesRes.error) throw sizesRes.error;
      if (shopsRes.error) throw shopsRes.error;

      const newData: CachedData = {
        categories: categoriesRes.data,
        sizes: sizesRes.data,
        shops: shopsRes.data,
        lastFetched: now,
      };

      // Cache the data
      localStorage.setItem(CACHE_KEY, JSON.stringify(newData));

      setCategories(categoriesRes.data);
      setSizes(sizesRes.data);
      setShops(shopsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshCache = () => {
    localStorage.removeItem(CACHE_KEY);
    loadData();
  };

  return {
    categories,
    sizes,
    shops,
    loading,
    refreshCache,
  };
};
