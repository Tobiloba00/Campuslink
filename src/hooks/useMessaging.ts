import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Message, Conversation, UserProfile, PostContext, MessageReaction } from '@/components/messaging/types';
import { uploadImage } from '@/lib/imageUpload';

export const useMessaging = (currentUserId: string | undefined) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [postContext, setPostContext] = useState<PostContext | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Refs to avoid stale closures in real-time listeners
  const messagesRef = useRef<Message[]>([]);
  const selectedRoomIdRef = useRef<string | null>(null);
  const selectedConversationRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);

  const MESSAGE_LIMIT = 50;

  // Sync refs
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { selectedRoomIdRef.current = selectedRoomId; }, [selectedRoomId]);
  useEffect(() => { selectedConversationRef.current = selectedConversation; }, [selectedConversation]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  // ─── Sound ───
  const playSound = useCallback(() => {
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {}
  }, []);

  // ─── 1. Fetch Conversations ───
  const fetchConversations = useCallback(async () => {
    if (!currentUserId) return;

    try {
      const { data: userRooms, error: roomsErr } = await supabase
        .from('room_participants')
        .select('room_id')
        .eq('user_id', currentUserId);

      if (roomsErr) throw roomsErr;
      if (!userRooms || userRooms.length === 0) {
        setConversations([]);
        setIsLoadingConversations(false);
        return;
      }

      const roomIds = userRooms.map(r => r.room_id);

      const [participantsRes, messagesRes] = await Promise.all([
        supabase.from('room_participants').select('room_id, user_id').in('room_id', roomIds).neq('user_id', currentUserId),
        supabase.from('messages').select('room_id, message, image_url, created_at, read_at, sender_id').in('room_id', roomIds).order('created_at', { ascending: false })
      ]);

      if (participantsRes.error) throw participantsRes.error;
      if (messagesRes.error) throw messagesRes.error;

      const otherParticipants = participantsRes.data || [];
      const allMessages = messagesRes.data || [];

      if (otherParticipants.length === 0) {
        setConversations([]);
        setIsLoadingConversations(false);
        return;
      }

      const otherUserIds = [...new Set(otherParticipants.map(p => p.user_id))];
      const { data: profiles, error: profilesErr } = await supabase
        .from('profiles')
        .select('id, name, profile_picture')
        .in('id', otherUserIds);

      if (profilesErr) throw profilesErr;

      const conversationMap = new Map<string, Conversation>();

      otherParticipants.forEach((participant) => {
        const profile = profiles?.find(p => p.id === participant.user_id);
        if (!profile) return;

        const roomMessages = allMessages.filter(m => m.room_id === participant.room_id);
        const lastMsg = roomMessages[0];
        const unreadCount = roomMessages.filter(
          m => m.sender_id === participant.user_id && m.read_at === null
        ).length;

        if (!conversationMap.has(participant.user_id)) {
          conversationMap.set(participant.user_id, {
            userId: participant.user_id,
            userName: profile.name,
            lastMessage: lastMsg?.message || (lastMsg?.image_url ? '📷 Image' : 'No messages yet'),
            timestamp: lastMsg?.created_at || new Date().toISOString(),
            profilePicture: profile.profile_picture,
            roomId: participant.room_id,
            unreadCount
          });
        }
      });

      const sorted = Array.from(conversationMap.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setConversations(sorted);
    } catch (error) {
      console.error('fetchConversations error:', error);
      toast.error("Failed to load conversations");
    } finally {
      setIsLoadingConversations(false);
    }
  }, [currentUserId]);

  // ─── 2. Get or Create Room ───
  const getOrCreateRoom = useCallback(async (otherUserId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.rpc('get_or_create_conversation_room', {
        other_user_id: otherUserId
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting/creating room:', error);
      toast.error("Failed to start conversation");
      return null;
    }
  }, []);

  // ─── 3. Mark Messages as Read ───
  const markMessagesAsRead = useCallback(async (roomId: string) => {
    if (!currentUserId) return;
    try {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .neq('sender_id', currentUserId)
        .is('read_at', null);

      setConversations(prev => prev.map(conv =>
        conv.roomId === roomId ? { ...conv, unreadCount: 0 } : conv
      ));
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [currentUserId]);

  // ─── 4. Fetch User Profile ───
  const fetchUserProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, profile_picture, rating, course, email')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setSelectedUserProfile(data as UserProfile);
    }
  }, []);

  // ─── 5. Fetch Messages (with pagination) ───
  const fetchMessages = useCallback(async (roomId: string, loadMore = false) => {
    if (!currentUserId) return;

    if (loadMore) {
      setIsLoadingMore(true);
    }

    try {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_LIMIT);

      if (loadMore && messagesRef.current.length > 0) {
        const oldestMessage = messagesRef.current[0];
        query = query.lt('created_at', oldestMessage.created_at);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        const typed = data.map((msg): Message => ({ ...msg, status: 'delivered' }));
        const reversed = typed.reverse();

        if (loadMore) {
          setMessages(prev => [...reversed, ...prev]);
        } else {
          setMessages(reversed);
        }
        setHasMore(data.length === MESSAGE_LIMIT);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error("Failed to load messages");
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentUserId]);

  // ─── 6. Load More Messages ───
  const loadMoreMessages = useCallback(() => {
    if (selectedRoomIdRef.current && hasMore && !isLoadingMore) {
      fetchMessages(selectedRoomIdRef.current, true);
    }
  }, [fetchMessages, hasMore, isLoadingMore]);

  // ─── 7. Send Message (Optimistic UI) ───
  const sendMessage = useCallback(async (text: string, imageFile: File | null, imagePreview: string | null) => {
    if (!currentUserId || !selectedConversationRef.current) return;

    const targetUserId = selectedConversationRef.current;
    const roomIdToUse = selectedRoomIdRef.current || await getOrCreateRoom(targetUserId);
    if (!roomIdToUse) return;

    if (!selectedRoomIdRef.current) {
      setSelectedRoomId(roomIdToUse);
    }

    const tempId = crypto.randomUUID();
    const optimisticMessage: Message = {
      id: tempId,
      sender_id: currentUserId,
      receiver_id: targetUserId,
      message: text.trim() || null,
      image_url: imagePreview,
      created_at: new Date().toISOString(),
      room_id: roomIdToUse,
      read_at: null,
      status: 'sending',
      tempId,
    };

    setMessages(prev => [...prev, optimisticMessage]);

    try {
      let imageUrl = null;
      if (imageFile) {
        const uploadResult = await uploadImage(imageFile, 'message-images', 'messages');
        imageUrl = uploadResult.url;
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUserId,
          receiver_id: targetUserId,
          message: optimisticMessage.message,
          image_url: imageUrl,
          room_id: roomIdToUse
        })
        .select()
        .single();

      if (error) throw error;

      // Replace optimistic message with real one
      setMessages(prev => prev.map(msg =>
        msg.tempId === tempId ? { ...data, status: 'sent' } : msg
      ));

      // Update conversation list preview
      setConversations(prev => {
        const existing = prev.find(c => c.roomId === roomIdToUse);
        if (existing) {
          return prev.map(conv =>
            conv.roomId === roomIdToUse
              ? { ...conv, lastMessage: data.message || (data.image_url ? '📷 Image' : ''), timestamp: data.created_at }
              : conv
          ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
        return prev;
      });
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.map(msg =>
        msg.tempId === tempId ? { ...msg, status: 'failed' } : msg
      ));
      toast.error("Message failed to send");
      throw error;
    }
  }, [currentUserId, getOrCreateRoom]);

  // ─── 8. Retry Failed Message ───
  const retryMessage = useCallback(async (failedMsg: Message) => {
    // Remove the failed message
    setMessages(prev => prev.filter(m => m.id !== failedMsg.id));

    // Re-send it
    try {
      await sendMessage(
        failedMsg.message || '',
        null, // Can't re-upload the file, send without image
        null
      );
    } catch {
      // sendMessage already handles error state
    }
  }, [sendMessage]);

  // ─── 9. Select Conversation ───
  const selectConversation = useCallback(async (userId: string, roomId: string | null) => {
    setSelectedConversation(userId);
    setMessages([]);
    setAiSuggestions([]);
    setPostContext(null);
    setHasMore(true);

    let activeRoom = roomId;
    if (!activeRoom) {
      activeRoom = await getOrCreateRoom(userId);
    }

    setSelectedRoomId(activeRoom);

    if (activeRoom) {
      await Promise.all([
        fetchMessages(activeRoom),
        markMessagesAsRead(activeRoom),
        fetchUserProfile(userId)
      ]);
    } else {
      await fetchUserProfile(userId);
    }
  }, [fetchMessages, markMessagesAsRead, fetchUserProfile, getOrCreateRoom]);

  // ─── 10. Post Context & AI Suggestions ───
  const fetchPostContext = useCallback(async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('id, title, description, category, user_id, profiles (name, course)')
        .eq('id', postId)
        .single();
      if (!error && data) {
        setPostContext(data as PostContext);
        return data as PostContext;
      }
    } catch (error) {
      console.error('Error fetching post context:', error);
    }
    return null;
  }, []);

  const fetchAiSuggestions = useCallback(async (post: PostContext, receiver: UserProfile, senderName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('ai-conversation-starters', {
        body: {
          postTitle: post.title,
          postDescription: post.description,
          postCategory: post.category,
          senderName,
          receiverName: receiver.name,
          receiverCourse: receiver.course
        }
      });
      if (!error && data?.suggestions) {
        setAiSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error('Error fetching AI suggestions:', error);
    }
  }, []);

  // ─── 11. Real-time: Selected Room Messages ───
  useEffect(() => {
    if (!selectedRoomId || !currentUserId) return;

    const channel = supabase
      .channel(`room-messages-${selectedRoomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${selectedRoomId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          // Skip if we already have it (optimistic or duplicate)
          if (messagesRef.current.find(m => m.id === newMsg.id || m.tempId === newMsg.id)) return;

          setMessages(prev => [...prev, { ...newMsg, status: 'delivered' }]);

          if (newMsg.sender_id !== currentUserId) {
            playSound();
            markMessagesAsRead(selectedRoomId);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=eq.${selectedRoomId}` },
        (payload) => {
          const updated = payload.new as Message;
          setMessages(prev => prev.map(msg => msg.id === updated.id ? { ...updated, status: 'delivered' } : msg));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedRoomId, currentUserId, playSound, markMessagesAsRead]);

  // ─── 12. Real-time: Global New Messages (for conversation list) ───
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('global-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as any;
          // Only care about messages sent TO us (not from us)
          if (newMsg.sender_id === currentUserId) return;
          if (newMsg.receiver_id !== currentUserId) return;

          // If the message is for the currently open room, it's handled by the room subscription
          if (newMsg.room_id === selectedRoomIdRef.current) return;

          // Update conversation list: bump unread count and last message
          setConversations(prev => {
            const existing = prev.find(c => c.roomId === newMsg.room_id);
            if (existing) {
              return prev.map(conv =>
                conv.roomId === newMsg.room_id
                  ? {
                      ...conv,
                      lastMessage: newMsg.message || (newMsg.image_url ? '📷 Image' : ''),
                      timestamp: newMsg.created_at,
                      unreadCount: conv.unreadCount + 1
                    }
                  : conv
              ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            }
            // New conversation — refresh the whole list
            fetchConversations();
            return prev;
          });

          playSound();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, fetchConversations, playSound]);

  // ─── 13. Reactions ───
  const fetchReactions = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) return;
    const { data, error } = await supabase
      .from('message_reactions')
      .select('message_id, emoji, user_id')
      .in('message_id', messageIds);

    if (error || !data) return;

    // Group reactions by message
    const reactionMap = new Map<string, MessageReaction[]>();
    data.forEach((r) => {
      const existing = reactionMap.get(r.message_id) || [];
      const emojiEntry = existing.find(e => e.emoji === r.emoji);
      if (emojiEntry) {
        emojiEntry.userIds.push(r.user_id);
        emojiEntry.count++;
      } else {
        existing.push({ emoji: r.emoji, userIds: [r.user_id], count: 1 });
      }
      reactionMap.set(r.message_id, existing);
    });

    setMessages(prev => prev.map(msg => {
      const reactions = reactionMap.get(msg.id);
      return reactions ? { ...msg, reactions } : msg;
    }));
  }, []);

  // Fetch reactions when messages load
  useEffect(() => {
    const realMessageIds = messages.filter(m => !m.tempId && m.id).map(m => m.id);
    if (realMessageIds.length > 0) {
      fetchReactions(realMessageIds);
    }
  }, [messages.length]); // Only re-fetch when message count changes

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!currentUserId) return;

    // Optimistic update
    setMessages(prev => prev.map(msg => {
      if (msg.id !== messageId) return msg;
      const reactions = [...(msg.reactions || [])];
      const existing = reactions.find(r => r.emoji === emoji);

      if (existing && existing.userIds.includes(currentUserId)) {
        // Remove reaction
        existing.userIds = existing.userIds.filter(id => id !== currentUserId);
        existing.count--;
        const filtered = reactions.filter(r => r.count > 0);
        return { ...msg, reactions: filtered };
      } else if (existing) {
        existing.userIds.push(currentUserId);
        existing.count++;
        return { ...msg, reactions };
      } else {
        reactions.push({ emoji, userIds: [currentUserId], count: 1 });
        return { ...msg, reactions };
      }
    }));

    // Persist
    try {
      const { data: existingReaction } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', currentUserId)
        .eq('emoji', emoji)
        .maybeSingle();

      if (existingReaction) {
        await supabase.from('message_reactions').delete().eq('id', existingReaction.id);
      } else {
        await supabase.from('message_reactions').insert({
          message_id: messageId,
          user_id: currentUserId,
          emoji
        });
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
      // Refetch to fix state
      fetchReactions([messageId]);
    }
  }, [currentUserId, fetchReactions]);

  // ─── 14. Refresh on Window Focus ───
  useEffect(() => {
    const handleFocus = () => {
      if (currentUserId) {
        fetchConversations();
        if (selectedRoomIdRef.current) {
          markMessagesAsRead(selectedRoomIdRef.current);
        }
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [currentUserId, fetchConversations, markMessagesAsRead]);

  return {
    conversations,
    selectedConversation,
    selectedUserProfile,
    messages,
    selectedRoomId,
    postContext,
    aiSuggestions,
    isLoadingConversations,
    isLoadingMore,
    hasMore,

    setPostContext,
    setAiSuggestions,
    setSelectedConversation,

    fetchConversations,
    fetchMessages,
    fetchPostContext,
    fetchAiSuggestions,
    selectConversation,
    sendMessage,
    retryMessage,
    loadMoreMessages,
    toggleReaction,
  };
};
