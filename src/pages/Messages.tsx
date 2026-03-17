import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, X, Image as ImageIcon, ArrowLeft, Home, Check, CheckCheck, MessageSquare, Sparkles, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadImage } from "@/lib/imageUpload";
import { ConversationListSkeleton } from "@/components/ui/skeleton-loaders";
import BottomNav from "@/components/BottomNav";

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string | null;
  image_url: string | null;
  created_at: string;
  room_id: string | null;
  read_at: string | null;
};

type Conversation = {
  userId: string;
  userName: string;
  lastMessage: string;
  timestamp: string;
  profilePicture?: string;
  roomId: string;
};

const Messages = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showConversations, setShowConversations] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const isInitialConversationLoadRef = useRef(true);
  const messageLimit = 10;
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const broadcastChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isAtBottomRef = useRef(true);
  const isInitialLoadRef = useRef(true);
  const messagesRef = useRef<Message[]>([]);
  const [postContext, setPostContext] = useState<any>(null);

  const formatMessageDate = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);

    if (messageDate.toDateString() === now.toDateString()) return 'Today';

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (messageDate.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return messageDate.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const groupedMessages = useMemo(() => {
    const groups: { date: string, messages: Message[] }[] = [];
    messages.forEach(msg => {
      const dateStr = formatMessageDate(new Date(msg.created_at));
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.date === dateStr) {
        lastGroup.messages.push(msg);
      } else {
        groups.push({ date: dateStr, messages: [msg] });
      }
    });
    return groups;
  }, [messages]);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const getOrCreateRoom = useCallback(async (otherUserId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.rpc('get_or_create_conversation_room', {
        other_user_id: otherUserId
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting/creating room:', error);
      return null;
    }
  }, []);

  // Main lifecycle effects - will be moved below definitions

  const markMessagesAsRead = useCallback(async (roomId: string) => {
    if (!currentUser) return;

    try {
      await (supabase as any)
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .neq('sender_id', currentUser.id)
        .is('read_at', null);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [currentUser]);

  const fetchConversations = useCallback(async () => {
    if (!currentUser) return;

    if (isInitialConversationLoadRef.current) {
      setIsLoadingConversations(true);
    }

    try {
      const { data: userRooms, error: userRoomsError } = await supabase
        .from('room_participants')
        .select('room_id')
        .eq('user_id', currentUser.id);

      if (userRoomsError) throw userRoomsError;

      if (!userRooms || userRooms.length === 0) {
        setConversations([]);
        setIsLoadingConversations(false);
        return;
      }

      const roomIds = userRooms.map(r => r.room_id);

      const [chatRoomsResult, otherParticipantsResult, allMessagesResult] = await Promise.all([
        supabase.from('chat_rooms').select('id, created_at, updated_at').in('id', roomIds),
        supabase.from('room_participants').select('room_id, user_id').in('room_id', roomIds).neq('user_id', currentUser.id),
        supabase.from('messages').select('room_id, message, image_url, created_at').in('room_id', roomIds).order('created_at', { ascending: false })
      ]);

      if (chatRoomsResult.error) throw chatRoomsResult.error;
      if (otherParticipantsResult.error) throw otherParticipantsResult.error;
      if (allMessagesResult.error) throw allMessagesResult.error;

      const otherParticipants = otherParticipantsResult.data;
      const allMessages = allMessagesResult.data;

      if (!otherParticipants || otherParticipants.length === 0) {
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

        const lastMsg = allMessages?.find(m => m.room_id === participant.room_id);

        if (!conversationMap.has(participant.user_id)) {
          conversationMap.set(participant.user_id, {
            userId: participant.user_id,
            userName: profile.name,
            lastMessage: lastMsg?.message || (lastMsg?.image_url ? '📷 Image' : 'No messages yet'),
            timestamp: lastMsg?.created_at || new Date().toISOString(),
            profilePicture: profile.profile_picture,
            roomId: participant.room_id
          });
        }
      });

      setConversations(Array.from(conversationMap.values()));
    } catch (error) {
      console.error('fetchConversations error:', error);
    } finally {
      setIsLoadingConversations(false);
      isInitialConversationLoadRef.current = false;
    }
  }, [currentUser]);

  const fetchUserProfile = useCallback(async () => {
    if (!selectedConversation) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', selectedConversation)
      .single();

    setSelectedUserProfile(data);
  }, [selectedConversation]);

  const scrollToBottom = useCallback((force = false) => {
    if (scrollAreaRef.current && (isAtBottomRef.current || force)) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, []);

  const fetchMessages = useCallback(async (loadMore = false) => {
    if (!currentUser || !selectedRoomId) return;
    if (loadMore && (!hasMore || isLoadingMore)) return;

    if (loadMore) setIsLoadingMore(true);

    try {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('room_id', selectedRoomId)
        .order('created_at', { ascending: false })
        .limit(messageLimit);

      if (loadMore && messagesRef.current.length > 0) {
        const oldestMessage = messagesRef.current[0];
        query = query.lt('created_at', oldestMessage.created_at);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        const typedMessages = (data as any[]).map((msg) => ({
          id: msg.id,
          sender_id: msg.sender_id,
          receiver_id: msg.receiver_id,
          message: msg.message,
          image_url: msg.image_url,
          created_at: msg.created_at,
          room_id: msg.room_id,
          read_at: msg.read_at,
        } as Message));

        if (loadMore) {
          setMessages(prev => {
            const newMessages = [...typedMessages.reverse(), ...prev];
            messagesRef.current = newMessages;
            return newMessages;
          });
          setHasMore(data.length === messageLimit);
        } else {
          const reversed = typedMessages.reverse();
          setMessages(reversed);
          messagesRef.current = reversed;
          setHasMore(data.length === messageLimit);
          if (isInitialLoadRef.current) {
            setTimeout(() => scrollToBottom(true), 100);
            isInitialLoadRef.current = false;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }

    if (loadMore) setIsLoadingMore(false);
  }, [currentUser, selectedRoomId, hasMore, isLoadingMore, messageLimit, scrollToBottom]);

  const fetchAiSuggestions = useCallback(async (post: any, receiver: any) => {
    if (!currentUser || !post || !receiver) return;

    setIsLoadingSuggestions(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-conversation-starters', {
        body: {
          postTitle: post.title,
          postDescription: post.description,
          postCategory: post.category,
          senderName: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'A Student',
          receiverName: receiver.name,
          receiverCourse: receiver.course
        }
      });

      if (error) throw error;
      if (data?.suggestions) {
        setAiSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error('Error fetching AI suggestions:', error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [currentUser]);

  const fetchPostContext = useCallback(async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id, title, description, category, user_id,
          profiles (name, course)
        `)
        .eq('id', postId)
        .single();

      if (error) throw error;
      setPostContext(data);
      return data;
    } catch (error) {
      console.error('Error fetching post context:', error);
      return null;
    }
  }, []);

  const playNotificationSound = useCallback((shouldPlay: boolean) => {
    if (!shouldPlay) return;

    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(err => console.log('Could not play sound:', err));
    } catch (error) {
      console.log('Audio not supported');
    }
  }, []);

  // Lifecycle Effects
  useEffect(() => {
    const initSetUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        const userIdParam = searchParams.get('userId');
        const postIdParam = searchParams.get('postId');
        const offerParam = searchParams.get('offer');

        // Pre-fill offer message if coming from Make Offer
        if (offerParam) {
          setNewMessage(decodeURIComponent(offerParam));
        }

        if (userIdParam) {
          // Eagerly fetch the profile to avoid "User" flicker
          supabase
            .from('profiles')
            .select('*')
            .eq('id', userIdParam)
            .single()
            .then(({ data }) => {
              if (data) setSelectedUserProfile(data);
            });

          getOrCreateRoom(userIdParam).then(async (roomId) => {
            setSelectedConversation(userIdParam);
            setSelectedRoomId(roomId);
            setShowConversations(false);

            // Refresh conversations so the new room appears in the sidebar
            setTimeout(() => fetchConversations(), 500);

            if (postIdParam) {
              const post = await fetchPostContext(postIdParam);
              // Only show AI suggestions if there's no offer pre-filled and the conversation is empty
              if (!offerParam) {
                const { count } = await supabase
                  .from('messages')
                  .select('*', { count: 'exact', head: true })
                  .eq('room_id', roomId);

                if (count === 0 && post) {
                  const { data: receiver } = await supabase
                    .from('profiles')
                    .select('name, course')
                    .eq('id', userIdParam)
                    .single();

                  if (receiver) {
                    fetchAiSuggestions(post, receiver);
                  }
                }
              }
            }
          });
        }
      } else {
        navigate('/auth');
      }
    };
    initSetUser();
  }, [searchParams, getOrCreateRoom, navigate, fetchConversations, fetchAiSuggestions, fetchPostContext]);

  useEffect(() => {
    if (currentUser) {
      fetchConversations();
    }
  }, [currentUser, fetchConversations]);

  useEffect(() => {
    if (selectedConversation && currentUser && selectedRoomId) {
      fetchMessages();
      fetchUserProfile();
      markMessagesAsRead(selectedRoomId);

      const channel = supabase
        .channel('messages-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${selectedRoomId}`
          },
          (payload) => {
            const newMessage = payload.new as Message;
            setMessages(prev => {
              if (prev.find(m => m.id === newMessage.id)) return prev;
              const updated = [...prev, newMessage];
              messagesRef.current = updated;
              if (newMessage.sender_id === currentUser.id || isAtBottomRef.current) {
                setTimeout(() => scrollToBottom(true), 50);
              }
              return updated;
            });
            playNotificationSound(newMessage.sender_id !== currentUser?.id);
            if (newMessage.sender_id !== currentUser?.id) {
              markMessagesAsRead(selectedRoomId);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${selectedRoomId}`
          },
          (payload) => {
            const updatedMessage = payload.new as Message;
            setMessages(prev => {
              const updated = prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg);
              messagesRef.current = updated;
              return updated;
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedConversation, currentUser, selectedRoomId, fetchMessages, fetchUserProfile, markMessagesAsRead, scrollToBottom, playNotificationSound]);

  useEffect(() => {
    if (!selectedRoomId || !currentUser) return;

    const presenceChannel = supabase.channel(`room:${selectedRoomId}:presence`, {
      config: { presence: { key: currentUser.id } }
    });

    const broadcast = supabase.channel(`room:${selectedRoomId}:broadcast`);
    broadcastChannelRef.current = broadcast;
    broadcast.subscribe();

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const userIds = new Set(Object.keys(state).filter(id => id !== currentUser.id));
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
            user_id: currentUser.id,
            online_at: new Date().toISOString()
          });
        }
      });

    broadcast
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user_id !== currentUser.id) {
          setTypingUsers(prev => new Set(prev).add(payload.user_id));

          setTimeout(() => {
            setTypingUsers(prev => {
              const updated = new Set(prev);
              updated.delete(payload.user_id);
              return updated;
            });
          }, 3000);
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
      if (broadcastChannelRef.current) {
        supabase.removeChannel(broadcastChannelRef.current);
        broadcastChannelRef.current = null;
      }
    };
  }, [selectedRoomId, currentUser]);

  useEffect(() => {
    if (!scrollAreaRef.current) return;

    const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    let scrollTimeout: NodeJS.Timeout;

    const handleScrollEvent = (e: Event) => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const element = e.target as HTMLDivElement;
        const threshold = 50;
        const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
        isAtBottomRef.current = isNearBottom;

        if (element.scrollTop === 0 && hasMore && !isLoadingMore) {
          const previousScrollHeight = element.scrollHeight;
          const oldMessagesLength = messagesRef.current.length;

          if (oldMessagesLength > 0) {
            // we use the oldest message right from messagesRef in fetchMessages,
            // but since fetchMessages uses messages directly if we change it to use state, we'll just let it use messagesRef.
            // Oh wait, fetchMessages still looks at `messages`, wait, I changed fetchMessages to not depend on `messages`.
            // Let me make sure `fetchMessages` reads from `messagesRef.current`.
            fetchMessages(true).then(() => {
              const newScrollHeight = element.scrollHeight;
              element.scrollTop = newScrollHeight - previousScrollHeight;
            });
          }
        }
      }, 50);
    };

    viewport.addEventListener('scroll', handleScrollEvent);
    return () => {
      viewport.removeEventListener('scroll', handleScrollEvent);
      clearTimeout(scrollTimeout);
    };
  }, [hasMore, isLoadingMore, selectedRoomId, fetchMessages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleTyping = () => {
    if (selectedRoomId && currentUser && broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: currentUser.id }
      });
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !selectedImage) || !currentUser || !selectedConversation) return;

    setUploading(true);
    try {
      let roomId = selectedRoomId;
      if (!roomId) {
        roomId = await getOrCreateRoom(selectedConversation);
        if (!roomId) {
          throw new Error('Failed to create chat room');
        }
        setSelectedRoomId(roomId);
      }

      let imageUrl = null;

      if (selectedImage) {
        const uploadResult = await uploadImage(selectedImage, 'message-images', 'messages');
        imageUrl = uploadResult.url;
      }

      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUser.id,
          receiver_id: selectedConversation,
          message: newMessage.trim() || null,
          image_url: imageUrl,
          room_id: roomId
        });

      if (error) throw error;

      setNewMessage("");
      clearImage();
      fetchConversations();
      // User sent a message, so scroll to bottom
      setTimeout(() => scrollToBottom(true), 100);
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(`Failed to send message: ${error?.message || JSON.stringify(error)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSelectConversation = async (userId: string, roomId: string | null) => {
    isInitialLoadRef.current = true;
    setSelectedConversation(userId);

    if (!roomId) {
      const newRoomId = await getOrCreateRoom(userId);
      setSelectedRoomId(newRoomId);
    } else {
      setSelectedRoomId(roomId);
    }

    setShowConversations(false);
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Navbar />
      <div className="container mx-auto px-4 py-4 flex flex-col flex-1 overflow-hidden pb-20 lg:pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl md:text-2xl font-bold">Messages</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/feed')}
            className="hidden lg:flex"
          >
            <Home className="h-4 w-4 mr-2" />
            Back to Feed
          </Button>
        </div>
        <div className="grid md:grid-cols-3 gap-4 md:gap-6 flex-1 overflow-hidden">
          <Card className={`glass-panel p-4 flex flex-col h-full overflow-hidden border-white/20 shadow-2xl ${showConversations ? 'block' : 'hidden md:block'}`}>
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Conversations
            </h2>
            <ScrollArea className="h-full">
              {isLoadingConversations ? (
                <ConversationListSkeleton />
              ) : conversations.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <p>No conversations yet</p>
                  <p className="text-sm mt-1">Start messaging someone!</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.userId}
                    onClick={() => handleSelectConversation(conv.userId, conv.roomId)}
                    className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer mb-1.5 transition-all duration-200 ${selectedConversation === conv.userId
                      ? "bg-primary/10 border border-primary/20 shadow-sm"
                      : "hover:bg-secondary/60 active:scale-[0.98]"
                      }`}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-12 w-12 ring-2 ring-background shadow-sm">
                        <AvatarImage src={conv.profilePicture || ""} />
                        <AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-primary/20 to-primary/10">
                          {conv.userName?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      {onlineUsers.has(conv.userId) && (
                        <div className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-success border-2 border-background shadow-md" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-sm truncate">{conv.userName}</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                          {new Date(conv.timestamp).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {conv.lastMessage || "📷 Photo"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </Card>

          <Card className={`md:col-span-2 glass-panel flex flex-col h-full overflow-hidden border-white/20 shadow-2xl bg-gradient-to-br from-card/80 to-card/40 ${showConversations ? 'hidden md:flex' : 'flex'}`}>
            {selectedConversation ? (
              <>
                <div className="p-3 sm:p-4 border-b bg-card/50 backdrop-blur-sm flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden hover:bg-secondary/80"
                    onClick={() => {
                      setShowConversations(true);
                      setSelectedConversation(null);
                    }}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="relative">
                    <Avatar className="h-11 w-11 ring-2 ring-primary/10 shadow-sm">
                      <AvatarImage src={selectedUserProfile?.profile_picture || ""} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 font-semibold">
                        {selectedUserProfile?.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    {selectedConversation && onlineUsers.has(selectedConversation) && (
                      <div className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-success border-2 border-background shadow-md animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-base sm:text-lg truncate">
                      {selectedUserProfile?.name || "User"}
                    </h2>
                    {selectedConversation && onlineUsers.has(selectedConversation) ? (
                      <p className="text-xs text-success font-medium">Active now</p>
                    ) : selectedUserProfile?.rating > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        ⭐ {selectedUserProfile.rating.toFixed(1)} rating
                      </p>
                    ) : null}
                  </div>
                </div>
                <ScrollArea
                  ref={scrollAreaRef}
                  className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 relative"
                  style={{
                    backgroundImage: 'url("/chat-bg.png")',
                    backgroundSize: '400px',
                    backgroundRepeat: 'repeat',
                    backgroundColor: 'hsl(var(--background) / 0.95)',
                    backgroundBlendMode: 'overlay'
                  }}
                >
                  {isLoadingMore && (
                    <div className="text-center text-sm text-muted-foreground py-2">
                      Loading older messages...
                    </div>
                  )}

                  {messages.length > 0 && (
                    <div className="flex justify-center mb-8">
                      <div className="bg-muted/30 backdrop-blur-sm border border-border/50 rounded-2xl px-4 py-2.5 max-w-sm text-center">
                        <p className="text-[11px] sm:text-xs text-muted-foreground/80">
                          🔒 End-to-end conversations • Keep it respectful
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-6 pb-4">
                    {postContext && messages.length > 0 && (
                      <div className="flex justify-center mb-6">
                        <Card
                          className="bg-primary/5 border-primary/20 backdrop-blur-md p-3 max-w-[80%] cursor-pointer hover:bg-primary/10 transition-all group"
                          onClick={() => navigate(`/post/${postContext.id}`)}
                        >
                          <div className="flex items-center gap-3">
                            {postContext.image_url && (
                              <img src={postContext.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">Reference Post</p>
                              <h4 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{postContext.title}</h4>
                            </div>
                            <ExternalLink className="h-4 w-4 text-primary opacity-50 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </Card>
                      </div>
                    )}

                    {groupedMessages.map((group, groupIdx) => (
                      <div key={group.date} className="space-y-4">
                        <div className="flex justify-center my-4 sticky top-0 z-10">
                          <span className="bg-background/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-muted-foreground uppercase tracking-widest border border-border/50 shadow-sm">
                            {group.date}
                          </span>
                        </div>

                        {group.messages.map((msg, msgIdx) => {
                          const isFirstInSequence = msgIdx === 0 || group.messages[msgIdx - 1].sender_id !== msg.sender_id;
                          const isLastInSequence = msgIdx === group.messages.length - 1 || group.messages[msgIdx + 1].sender_id !== msg.sender_id;
                          const isMe = msg.sender_id === currentUser?.id;

                          return (
                            <div
                              key={msg.id}
                              className={`flex gap-2 group relative ${isMe ? "justify-end" : "justify-start"} ${isFirstInSequence ? 'mt-4' : 'mt-1'}`}
                            >
                              {!isMe && isFirstInSequence && (
                                <Avatar className="h-8 w-8 ring-2 ring-background shadow-sm absolute -left-10 hidden sm:flex">
                                  <AvatarImage src={selectedUserProfile?.profile_picture || ""} />
                                  <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-primary/10">
                                    {selectedUserProfile?.name?.charAt(0) || "?"}
                                  </AvatarFallback>
                                </Avatar>
                              )}

                              <div className={`flex flex-col max-w-[85%] sm:max-w-[70%] lg:max-w-[60%] relative`}>
                                <div
                                  className={`p-2.5 sm:p-3 rounded-2xl transition-all duration-200 shadow-sm relative ${isMe
                                    ? "bg-primary text-primary-foreground rounded-tr-none"
                                    : "bg-card border border-border/40 rounded-tl-none"
                                    } ${!isFirstInSequence ? 'rounded-t-2xl' : ''}`}
                                >
                                  {/* Bubble Tail */}
                                  {isFirstInSequence && (
                                    <div className={`absolute top-0 w-3 h-3 ${isMe
                                      ? "right-[-6px] bg-primary clip-path-tail-right"
                                      : "left-[-6px] bg-card border-l border-t border-border/40 clip-path-tail-left"
                                      }`} />
                                  )}

                                  {msg.image_url && (
                                    <div className="relative group/img overflow-hidden rounded-xl mb-1.5 grayscale-[0.2] hover:grayscale-0 transition-all">
                                      <img
                                        src={msg.image_url}
                                        alt="Message attachment"
                                        className="w-full max-h-80 object-cover cursor-pointer hover:scale-[1.02] transition-transform duration-500"
                                        onClick={() => window.open(msg.image_url!, '_blank')}
                                      />
                                    </div>
                                  )}

                                  {msg.message && (
                                    <p className="text-[14px] sm:text-[15px] leading-relaxed break-words px-0.5">
                                      {msg.message}
                                    </p>
                                  )}

                                  <div className={`flex items-center gap-1.5 mt-1 justify-end opacity-70`}>
                                    <span className="text-[9px] sm:text-[10px] font-medium uppercase tracking-tighter">
                                      {new Date(msg.created_at).toLocaleTimeString('en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true
                                      })}
                                    </span>
                                    {isMe && (
                                      msg.read_at ? (
                                        <CheckCheck className="h-3 w-3 text-blue-400" />
                                      ) : (
                                        <Check className="h-3 w-3 text-primary-foreground/50" />
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}

                    {typingUsers.size > 0 && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground italic animate-pulse py-2">
                        <div className="flex gap-1">
                          <span className="h-1.5 w-1.5 bg-muted-foreground/30 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                          <span className="h-1.5 w-1.5 bg-muted-foreground/30 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="h-1.5 w-1.5 bg-muted-foreground/30 rounded-full animate-bounce"></span>
                        </div>
                        <span>Typing...</span>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                {imagePreview && (
                  <div className="px-3 md:px-4 py-2 border-t">
                    <div className="relative inline-block">
                      <img src={imagePreview} alt="Preview" className="h-20 rounded" />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={clearImage}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                <div className="p-3 sm:p-4 border-t bg-card/30 backdrop-blur-sm flex flex-col gap-3">
                  {aiSuggestions.length > 0 && messages.length === 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] font-bold text-primary/60 uppercase tracking-wider flex items-center gap-1.5 ml-1">
                        <Sparkles className="h-3 w-3" />
                        AI Conversation Starters
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {aiSuggestions.map((suggestion, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setNewMessage(suggestion);
                              setAiSuggestions([]);
                            }}
                            className="text-left text-xs bg-primary/5 hover:bg-primary/10 border border-primary/10 hover:border-primary/20 rounded-2xl px-4 py-2.5 transition-all text-foreground/80 hover:text-foreground active:scale-95 animate-in fade-in slide-in-from-bottom-2 duration-300"
                            style={{ animationDelay: `${i * 100}ms` }}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {postContext && (
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-2xl border border-border/40 mb-1 animate-in fade-in duration-500">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 bg-primary/10 rounded-lg">
                          <ImageIcon className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <p className="text-xs truncate">
                          Replying to: <span className="font-semibold">{postContext.title}</span>
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full"
                        onClick={() => setPostContext(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <input
                      type="file"
                      id="message-image"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageSelect}
                      disabled={uploading}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors h-10 w-10 flex-shrink-0"
                      onClick={() => document.getElementById('message-image')?.click()}
                      disabled={uploading}
                    >
                      <ImageIcon className="h-5 w-5" />
                    </Button>
                    <Input
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                      }}
                      placeholder="Message..."
                      onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                      disabled={uploading}
                      className="flex-1 rounded-full bg-card/40 backdrop-blur-md border border-border/40 focus-visible:ring-1 focus-visible:ring-primary/50 px-4 py-2 h-10 placeholder:text-muted-foreground/60"
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={uploading || (!newMessage.trim() && !selectedImage)}
                      className="rounded-full h-10 w-10 p-0 shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex-shrink-0"
                      size="icon"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground p-4 text-center">
                Select a conversation to start messaging
              </div>
            )}
          </Card>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Messages;
