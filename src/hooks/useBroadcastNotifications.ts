import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface BroadcastNotification {
  id: string;
  message: string;
  target_role: string;
  sent_at: string;
}

/**
 * Realtime subscription for broadcast notifications.
 * Listens to the audit_log table for BROADCAST_SENT events
 * and surfaces them as live notifications.
 *
 * This provides near-real-time broadcast delivery without
 * requiring FCM push notifications (which would need server-side setup).
 * Users see broadcasts immediately when the app is in the foreground.
 */
export function useBroadcastNotifications(userRole?: string) {
  const [latestBroadcast, setLatestBroadcast] = useState<BroadcastNotification | null>(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    if (!userRole) return;

    const channel = supabase
      .channel('broadcast-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'audit_log',
          filter: 'action=eq.BROADCAST_SENT',
        },
        (payload) => {
          const record = payload.new;
          const metadata = record.metadata;
          if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return;

          const targetRole = (metadata.target_role as string) || 'ALL';
          // Only surface broadcasts targeted at this user's role (or ALL)
          if (targetRole !== 'ALL' && targetRole !== userRole) return;

          setLatestBroadcast({
            id: record.id,
            message: (metadata.message as string) || '',
            target_role: targetRole,
            sent_at: record.created_at,
          });
        }
      )
      .subscribe((status) => {
        setIsListening(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userRole]);

  const dismissBroadcast = useCallback(() => {
    setLatestBroadcast(null);
  }, []);

  return { latestBroadcast, isListening, dismissBroadcast };
}
