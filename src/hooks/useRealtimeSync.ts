import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthContext } from '../config/providers';
import { supabase } from '../lib/supabase';

/**
 * Realtime order receipts — one postgres_changes channel for the session.
 * Any remote change to `orders` / `disputes` (counterparty settled, admin
 * resolved, pool dispatched…) invalidates the react-query caches so every
 * screen reflects reality without pull-to-refresh. RLS row filters apply
 * per subscriber (migration 017), so no data leaks across roles.
 */
export function useRealtimeSync(enabled: boolean) {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  // Debounce: bursts of events (pool dispatch creates many order rows) collapse
  // into one invalidation per tick.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !user) return;

    const invalidate = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['disputes'] });
      }, 300);
    };

    const channel = supabase
      .channel('orders-receipts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        invalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dispute_tickets' },
        invalidate,
      )
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [enabled, user, queryClient]);
}
