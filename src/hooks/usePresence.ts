// ============================================================================
// usePresence — Online status & typing indicators
// Dedicated hook for real-time presence tracking
// ============================================================================

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UsePresenceOptions {
  roomId: string | null;
  currentUserId: string | null;
}

export const usePresence = ({ roomId, currentUserId }: UsePresenceOptions) => {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track online presence
  useEffect(() => {
    if (!roomId || !currentUserId) return;

    const presenceChannel = supabase.channel(`room:${roomId}:presence`, {
      config: { presence: { key: currentUserId } }
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const userIds = new Set(Object.keys(state).filter(id => id !== currentUserId));
        setOnlineUsers(userIds);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUsers(prev => new Set(prev).add(key));
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers(prev => {
          const updated = new Set(prev);
          updated.delete(key);
          return updated;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: currentUserId,
            online_at: new Date().toISOString()
          });
        }
      });

    // Broadcast channel for typing indicators
    const broadcast = supabase.channel(`room:${roomId}:broadcast`);
    broadcastChannelRef.current = broadcast;

    broadcast
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user_id !== currentUserId) {
          setTypingUsers(prev => new Set(prev).add(payload.user_id));
          setTimeout(() => {
            setTypingUsers(prev => {
              const updated = new Set(prev);
              updated.delete(payload.user_id);
              return updated;
            });
          }, 2000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
      if (broadcastChannelRef.current) {
        supabase.removeChannel(broadcastChannelRef.current);
        broadcastChannelRef.current = null;
      }
    };
  }, [roomId, currentUserId]);

  // Send typing indicator (debounced)
  const sendTypingIndicator = useCallback(() => {
    if (!broadcastChannelRef.current || !currentUserId) return;

    if (typingTimeoutRef.current) return; // Already sent recently

    broadcastChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: currentUserId }
    });

    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 300);
  }, [currentUserId]);

  return {
    onlineUsers,
    typingUsers,
    sendTypingIndicator,
  };
};
