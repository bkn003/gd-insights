import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { RealtimeChannel } from '@supabase/supabase-js';

type TableName = 'goods_damaged_entries' | 'profiles' | 'shops' | 'categories' | 'sizes' | 'customer_types' | 'gd_entry_images' | 'app_settings';

interface UseRealtimeSyncOptions {
  tables: TableName[];
  onProfileDeleted?: (userId: string) => void;
  enabled?: boolean;
}

export const useRealtimeSync = ({
  tables,
  onProfileDeleted,
  enabled = true,
}: UseRealtimeSyncOptions) => {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const invalidateQueries = useCallback((table: string) => {
    // Invalidate all related queries for instant UI updates
    switch (table) {
      case 'goods_damaged_entries':
        queryClient.invalidateQueries({ queryKey: ['dashboard-entries'] });
        queryClient.invalidateQueries({ queryKey: ['reports-data'] });
        break;
      case 'profiles':
        queryClient.invalidateQueries({ queryKey: ['profiles'] });
        break;
      case 'shops':
        queryClient.invalidateQueries({ queryKey: ['shops'] });
        queryClient.invalidateQueries({ queryKey: ['cached-data'] });
        break;
      case 'categories':
        queryClient.invalidateQueries({ queryKey: ['categories'] });
        queryClient.invalidateQueries({ queryKey: ['cached-data'] });
        break;
      case 'sizes':
        queryClient.invalidateQueries({ queryKey: ['sizes'] });
        queryClient.invalidateQueries({ queryKey: ['cached-data'] });
        break;
      case 'customer_types':
        queryClient.invalidateQueries({ queryKey: ['customer-types'] });
        queryClient.invalidateQueries({ queryKey: ['cached-data'] });
        break;
      case 'gd_entry_images':
        queryClient.invalidateQueries({ queryKey: ['dashboard-entries'] });
        queryClient.invalidateQueries({ queryKey: ['reports-data'] });
        break;
      case 'app_settings':
        queryClient.invalidateQueries({ queryKey: ['app-settings'] });
        break;
      default:
        // Invalidate everything as fallback
        queryClient.invalidateQueries();
    }
  }, [queryClient]);

  useEffect(() => {
    if (!enabled) return;

    // Create a single channel for all table subscriptions
    const channel = supabase.channel('realtime-sync', {
      config: {
        broadcast: { self: true },
      },
    });

    // Subscribe to each table
    tables.forEach((table) => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
        },
        (payload) => {
          console.log(`Realtime update on ${table}:`, payload.eventType);
          
          // Handle profile deletion for force logout
          if (table === 'profiles') {
            if (payload.eventType === 'DELETE') {
              const deletedId = (payload.old as any)?.id;
              if (deletedId && onProfileDeleted) {
                onProfileDeleted(deletedId);
              }
            } else if (payload.eventType === 'UPDATE') {
              const updatedProfile = payload.new as any;
              if (updatedProfile?.deleted_at && onProfileDeleted) {
                onProfileDeleted(updatedProfile.id);
              }
            }
          }
          
          // Invalidate queries for immediate UI update
          invalidateQueries(table);
        }
      );
    });

    // Subscribe to channel
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Realtime sync connected for:', tables.join(', '));
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, tables.join(','), invalidateQueries, onProfileDeleted]);

  // Manual refresh function
  const refresh = useCallback(() => {
    tables.forEach((table) => invalidateQueries(table));
  }, [tables, invalidateQueries]);

  return { refresh };
};

// Hook for force logout when user is deleted
export const useForceLogoutOnDelete = (
  currentUserId: string | undefined,
  signOut: () => Promise<{ error: any }>
) => {
  const handleProfileDeleted = useCallback(
    async (deletedUserId: string) => {
      if (currentUserId && deletedUserId === currentUserId) {
        console.log('Current user was deleted, forcing logout...');
        await signOut();
        window.location.href = '/';
      }
    },
    [currentUserId, signOut]
  );

  return handleProfileDeleted;
};
