import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Message, Conversation, UserProfile, PostContext, CurrentUser } from '@/components/messaging/types';
import { uploadImage } from '@/lib/imageUpload';

export const useMessaging = (currentUserId: string | undefined) => {
  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [postContext, setPostContext] = useState<PostContext | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  
  // Loading & Pagination States
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  // Refs to avoid stale closures in listeners
  const messagesRef = useRef<Message[]>([]);
  const selectedRoomIdRef = useRef<string | null>(null);
  
  const messageLimit = 50;

  // Sync refs when state changes
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
  }, [selectedRoomId]);

  // Make a secure sound player
  const playSound = useCallback(() => {
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (e) {}
  }, []);

  // 1. Fetch Conversations
  const fetchConversations = useCallback(async () => {
    if (!currentUserId) return;
    
    try {
      const { data: userRooms, error: userRoomsError } = await supabase
        .from('room_participants')
        .select('room_id')
        .eq('user_id', currentUserId);

      if (userRoomsError) throw userRoomsError;
      if (!userRooms || userRooms.length === 0) {
        setConversations([]);
        setIsLoadingConversations(false);
        return;
      }

      const roomIds = userRooms.map(r => r.room_id);

      const [otherParticipantsResult, allMessagesResult] = await Promise.all([
        supabase.from('room_participants').select('room_id, user_id').in('room_id', roomIds).neq('user_id', currentUserId),
        supabase.from('messages').select('room_id, message, image_url, created_at, read_at, sender_id').in('room_id', roomIds).order('created_at', { ascending: false })
      ]);

      if (otherParticipantsResult.error) throw otherParticipantsResult.error;
      if (allMessagesResult.error) throw allMessagesResult.error;

      const otherParticipants = otherParticipantsResult.data || [];
      const allMessages = allMessagesResult.data || [];

      if (otherParticipants.length === 0) {
        setConversations([]);
        setIsLoadingConversations(false);
        return;
      }

      const otherUserIds = otherParticipants.map(p => p.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, profile_picture')
        .in('id', otherUserIds);

      if (profilesError) throw profilesError;

      const conversationMap = new Map<string, Conversation>();

      otherParticipants.forEach((participant) => {
        const profile = profiles?.find(p => p.id === participant.user_id);
        if (!profile) return;

        const roomMessages = allMessages.filter(m => m.room_id === participant.room_id) || [];
        const lastMsg = roomMessages[0]; // Already sorted desc
        
        // Count unread messages (where I am the receiver and it's unread)
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

      // Sort by latest message
      const sortedConversations = Array.from(conversationMap.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      setConversations(sortedConversations);
    } catch (error) {
      console.error('fetchConversations error:', error);
      toast.error("Failed to load conversations");
    } finally {
      setIsLoadingConversations(false);
    }
  }, [currentUserId]);

  // 2. Room Creation
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

  // 3. Mark Read
  const markMessagesAsRead = useCallback(async (roomId: string) => {
    if (!currentUserId) return;
    try {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .neq('sender_id', currentUserId)
        .is('read_at', null);
      
      // Update local unread count
      setConversations(prev => prev.map(conv => 
        conv.roomId === roomId ? { ...conv, unreadCount: 0 } : conv
      ));
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [currentUserId]);

  // 4. Fetch User Profile
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

  // 5. Fetch Messages
  const fetchMessages = useCallback(async (roomId: string, loadMore = false) => {
    if (!currentUserId) return;
    
    if (loadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoadingMessages(true);
    }

    try {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(messageLimit);

      if (loadMore && messagesRef.current.length > 0) {
        const oldestMessage = messagesRef.current[0];
        query = query.lt('created_at', oldestMessage.created_at);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        const typedMessages = data.map((msg): Message => ({
          ...msg,
          status: 'delivered',
        }));

        const reversed = typedMessages.reverse();

        if (loadMore) {
          setMessages(prev => [...reversed, ...prev]);
        } else {
          setMessages(reversed);
        }
        setHasMore(data.length === messageLimit);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error("Failed to load messages");
    } finally {
      setIsLoadingMessages(false);
      setIsLoadingMore(false);
    }
  }, [currentUserId]);

  // 6. Send Message (Optimistic UI)
  const sendMessage = useCallback(async (text: string, imageFile: File | null, imagePreview: string | null) => {
    if (!currentUserId || !selectedConversation) return;

    const roomIdToUse = selectedRoomIdRef.current || await getOrCreateRoom(selectedConversation);
    if (!roomIdToUse) return;
    
    if (!selectedRoomIdRef.current) {
      setSelectedRoomId(roomIdToUse);
    }

    const tempId = crypto.randomUUID();
    const optimisticMessage: Message = {
      id: tempId,
      sender_id: currentUserId,
      receiver_id: selectedConversation,
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
          receiver_id: selectedConversation,
          message: optimisticMessage.message,
          image_url: imageUrl,
          room_id: roomIdToUse
        })
        .select()
        .single();

      if (error) throw error;

      setMessages(prev => prev.map(msg => 
        msg.tempId === tempId ? { ...data, status: 'sent' } : msg
      ));
      
      // Update quick preview in conversation list
      setConversations(prev => prev.map(conv => 
        conv.roomId === roomIdToUse ? { 
          ...conv, 
          lastMessage: data.message || (data.image_url ? '📷 Image' : ''),
          timestamp: data.created_at
        } : conv
      ));

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.map(msg => 
        msg.tempId === tempId ? { ...msg, status: 'failed' } : msg
      ));
      toast.error("Message failed to send.");
      throw error;
    }
  }, [currentUserId, selectedConversation, getOrCreateRoom]);

  // 7. Retrying failed message
  const retryMessage = useCallback(async (msgToRetry: Message) => {
    // Remove the failed message, then send again. 
    // Usually implies keeping it in state until success or letting the user edit.
    // To make it simple, we just export removeMessage and let UI put it in input
    setMessages(prev => prev.filter(m => m.id !== msgToRetry.id));
  }, []);

  // 8. AI Suggestions & Context
  const fetchPostContext = useCallback(async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`id, title, description, category, user_id, profiles (name, course)`)
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
          senderName: senderName,
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

  // Selection handler
  const selectConversation = useCallback(async (userId: string, roomId: string | null) => {
    setSelectedConversation(userId);
    setMessages([]); // clear current messages
    setIsLoadingMessages(true);
    
    let activeRoom = roomId;
    if (!activeRoom) {
      activeRoom = await getOrCreateRoom(userId);
    }
    
    setSelectedRoomId(activeRoom);
    
    if (activeRoom) {
      await fetchMessages(activeRoom);
      await markMessagesAsRead(activeRoom);
    }
    
    await fetchUserProfile(userId);
  }, [fetchMessages, markMessagesAsRead, fetchUserProfile, getOrCreateRoom]);

  // Real-time Subscriptions Setup
  useEffect(() => {
    if (!selectedRoomId || !currentUserId) return;

    const channel = supabase
      .channel(`messages-changes-${selectedRoomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${selectedRoomId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          // Ignore if we already have it optimistically
          if (messagesRef.current.find(m => m.id === newMsg.id)) return;
          
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
          const updatedMsg = payload.new as Message;
          setMessages(prev => prev.map(msg => msg.id === updatedMsg.id ? { ...updatedMsg, status: 'delivered' } : msg));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedRoomId, currentUserId, playSound, markMessagesAsRead]);

  return {
    conversations,
    selectedConversation,
    selectedUserProfile,
    messages,
    selectedRoomId,
    postContext,
    aiSuggestions,
    isLoadingConversations,
    isLoadingMessages,
    isLoadingMore,
    hasMore,
    
    setPostContext,
    setAiSuggestions,
    setSelectedConversation, // for closing view
    
    fetchConversations,
    fetchMessages,
    fetchPostContext,
    fetchAiSuggestions,
    selectConversation,
    sendMessage,
    retryMessage
  };
};
