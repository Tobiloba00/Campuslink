import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, X, Image as ImageIcon, ArrowLeft, Home, Check, CheckCheck } from "lucide-react";
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
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isAtBottomRef = useRef(true);
  const isInitialLoadRef = useRef(true);

  const getOrCreateRoom = useCallback(async (otherUserId: string): Promise<string | null> => {
    if (!currentUser) return null;

    try {
      const { data: existingRooms, error: searchError } = await supabase
        .from('room_participants')
        .select('room_id')
        .eq('user_id', currentUser.id);

      if (searchError) throw searchError;

      if (existingRooms && existingRooms.length > 0) {
        const roomIds = existingRooms.map(r => r.room_id);
        
        const { data: otherUserRooms, error: otherError } = await supabase
          .from('room_participants')
          .select('room_id')
          .eq('user_id', otherUserId)
          .in('room_id', roomIds);

        if (otherError) throw otherError;

        if (otherUserRooms && otherUserRooms.length > 0) {
          return otherUserRooms[0].room_id;
        }
      }

      const { data: newRoom, error: roomError } = await supabase
        .from('chat_rooms')
        .insert({ type: 'direct' })
        .select()
        .single();

      if (roomError) throw roomError;

      const { error: participantsError } = await supabase
        .from('room_participants')
        .insert([
          { room_id: newRoom.id, user_id: currentUser.id },
          { room_id: newRoom.id, user_id: otherUserId }
        ]);

      if (participantsError) throw participantsError;

      return newRoom.id;
    } catch (error) {
      console.error('Error getting/creating room:', error);
      toast.error('Failed to create chat room');
      return null;
    }
  }, [currentUser]);

  useEffect(() => {
    const initializeChat = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      
      if (user) {
        const userId = searchParams.get('userId');
        if (userId) {
          setTimeout(async () => {
            const roomId = await getOrCreateRoom(userId);
            setSelectedConversation(userId);
            setSelectedRoomId(roomId);
          }, 100);
        }
      }
    };
    
    initializeChat();
  }, [searchParams, getOrCreateRoom]);

  useEffect(() => {
    if (currentUser) {
      fetchConversations();
    }
  }, [currentUser]);

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
              return [...prev, newMessage];
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
            setMessages(prev => prev.map(msg => 
              msg.id === updatedMessage.id ? updatedMessage : msg
            ));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedConversation, currentUser, selectedRoomId]);


  // Presence tracking (online status)
  useEffect(() => {
    if (!selectedRoomId || !currentUser) return;

    const presenceChannel = supabase.channel(`room:${selectedRoomId}:presence`, {
      config: { presence: { key: currentUser.id } }
    });

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

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [selectedRoomId, currentUser]);

  // Typing indicator broadcast
  useEffect(() => {
    if (!selectedRoomId || !currentUser) return;

    const broadcastChannel = supabase.channel(`room:${selectedRoomId}:broadcast`);

    broadcastChannel
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
      })
      .subscribe();

    return () => {
      supabase.removeChannel(broadcastChannel);
    };
  }, [selectedRoomId, currentUser]);

  // Attach scroll handler to the correct viewport element
  useEffect(() => {
    if (!scrollAreaRef.current) return;
    
    const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    let scrollTimeout: NodeJS.Timeout;
    
    const handleScrollEvent = (e: Event) => {
      // Debounce scroll handler
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const element = e.target as HTMLDivElement;
        const threshold = 50;
        const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
        isAtBottomRef.current = isNearBottom;
        
        // Infinite scroll for older messages
        if (element.scrollTop === 0 && hasMore && !isLoadingMore) {
          const previousScrollHeight = element.scrollHeight;
          fetchMessages(true).then(() => {
            const newScrollHeight = element.scrollHeight;
            element.scrollTop = newScrollHeight - previousScrollHeight;
          });
        }
      }, 50);
    };

    viewport.addEventListener('scroll', handleScrollEvent);
    return () => {
      viewport.removeEventListener('scroll', handleScrollEvent);
      clearTimeout(scrollTimeout);
    };
  }, [hasMore, isLoadingMore, selectedRoomId]);

  const markMessagesAsRead = async (roomId: string) => {
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
  };

  const fetchConversations = async () => {
    if (!currentUser) return;

    // Only show skeleton on initial load, not refetches
    if (isInitialConversationLoadRef.current) {
      setIsLoadingConversations(true);
    }

    try {
      // Step 1: Get room IDs for current user
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

      // OPTIMIZED: Parallel queries instead of sequential
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

      // Fetch profiles for other participants
      const otherUserIds = otherParticipants.map(p => p.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, profile_picture')
        .in('id', otherUserIds);

      if (profilesError) throw profilesError;

      // Combine results
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
      toast.error('Failed to load conversations');
    } finally {
      setIsLoadingConversations(false);
      isInitialConversationLoadRef.current = false;
    }
  };

  const fetchUserProfile = async () => {
    if (!selectedConversation) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', selectedConversation)
      .single();

    setSelectedUserProfile(data);
  };

  const fetchMessages = async (loadMore = false) => {
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

      if (loadMore && messages.length > 0) {
        const oldestMessage = messages[0];
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
          setMessages([...typedMessages.reverse(), ...messages]);
          setHasMore(data.length === messageLimit);
        } else {
          setMessages(typedMessages.reverse());
          setHasMore(data.length === messageLimit);
          // Only scroll to bottom on initial load
          if (isInitialLoadRef.current) {
            setTimeout(() => scrollToBottom(true), 100);
            isInitialLoadRef.current = false;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    }

    if (loadMore) setIsLoadingMore(false);
  };

  const scrollToBottom = useCallback((force = false) => {
    if (scrollAreaRef.current && (isAtBottomRef.current || force)) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, []);

  const playNotificationSound = (shouldPlay: boolean) => {
    if (!shouldPlay) return;
    
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(err => console.log('Could not play sound:', err));
    } catch (error) {
      console.log('Audio not supported');
    }
  };

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
    if (selectedRoomId && currentUser) {
      const channel = supabase.channel(`room:${selectedRoomId}:broadcast`);
      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: currentUser.id }
      });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
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
        } as any);

      if (error) throw error;

      setNewMessage("");
      clearImage();
      fetchConversations();
      // User sent a message, so scroll to bottom
      setTimeout(() => scrollToBottom(true), 100);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error("Failed to send message");
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
          <Card className={`shadow-card p-4 flex flex-col h-full overflow-hidden ${showConversations ? 'block' : 'hidden md:block'}`}>
            <h2 className="font-bold text-lg mb-4">Conversations</h2>
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
                    className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer mb-1.5 transition-all duration-200 ${
                      selectedConversation === conv.userId
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

          <Card className={`md:col-span-2 shadow-card flex flex-col h-full overflow-hidden bg-gradient-to-br from-card to-card/95 ${showConversations ? 'hidden md:flex' : 'flex'}`}>
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
                  className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6" 
                  style={{
                    backgroundColor: 'hsl(var(--background))'
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

                  <div className="space-y-4 pb-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-2 group ${
                          msg.sender_id === currentUser?.id ? "justify-end" : "justify-start"
                        }`}
                      >
                        {msg.sender_id !== currentUser?.id && (
                          <Avatar className="h-9 w-9 ring-2 ring-background shadow-sm">
                            <AvatarImage src={selectedUserProfile?.profile_picture || ""} />
                            <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-primary/10">
                              {selectedUserProfile?.name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="flex flex-col max-w-[70%] sm:max-w-[65%]">
                          <div
                            className={`p-3 sm:p-3.5 rounded-2xl transition-all duration-200 ${
                              msg.sender_id === currentUser?.id
                                ? "bg-primary text-primary-foreground rounded-br-sm shadow-md hover:shadow-lg"
                                : "bg-secondary/80 rounded-bl-sm shadow-sm hover:shadow-md hover:bg-secondary"
                            }`}
                          >
                            {msg.image_url && (
                              <img 
                                src={msg.image_url} 
                                alt="Message attachment" 
                                className="rounded-xl max-w-full sm:max-w-[280px] max-h-60 object-cover cursor-pointer hover:opacity-95 transition-all mb-2"
                                onClick={() => window.open(msg.image_url!, '_blank')}
                              />
                            )}
                            {msg.message && (
                              <p className={`text-sm sm:text-[15px] leading-relaxed ${msg.image_url ? 'mt-2' : ''}`}>
                                {msg.message}
                              </p>
                            )}
                          </div>
                          
                          <div className={`flex items-center gap-1.5 mt-1 ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-[10px] sm:text-xs text-muted-foreground">
                              {new Date(msg.created_at).toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true 
                              })}
                            </span>
                            {msg.sender_id === currentUser?.id && (
                              msg.read_at ? (
                                <CheckCheck className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <Check className="h-3.5 w-3.5 text-muted-foreground/70" />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {typingUsers.size > 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={selectedUserProfile?.profile_picture || ""} />
                          <AvatarFallback className="text-xs">
                            {selectedUserProfile?.name?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span>{selectedUserProfile?.name} is typing...</span>
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
                <div className="p-3 sm:p-4 border-t bg-card/30 backdrop-blur-sm flex items-end gap-2">
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
                    className="flex-1 rounded-full bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50 px-4 py-2 h-10 placeholder:text-muted-foreground/60"
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
