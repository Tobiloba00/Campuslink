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

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string | null;
  image_url: string | null;
  created_at: string;
  room_id: string | null;
  read_at: string | null;
  reactions?: { emoji: string; user_id: string }[];
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
  const messageLimit = 10;
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const getOrCreateRoom = useCallback(async (otherUserId: string): Promise<string | null> => {
    if (!currentUser) return null;

    try {
      // Check if a room already exists between these two users
      const { data: existingRooms, error: searchError } = await supabase
        .from('room_participants')
        .select('room_id')
        .eq('user_id', currentUser.id);

      if (searchError) throw searchError;

      if (existingRooms && existingRooms.length > 0) {
        const roomIds = existingRooms.map(r => r.room_id);
        
        // Check which of these rooms also has the other user
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

      // Create new room
      const { data: newRoom, error: roomError } = await supabase
        .from('chat_rooms')
        .insert({ type: 'direct' })
        .select()
        .single();

      if (roomError) throw roomError;

      // Add both participants
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
          // Delay to ensure currentUser is set for getOrCreateRoom
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
            scrollToBottom();
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
          () => fetchMessages()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedConversation, currentUser, selectedRoomId]);

  // Realtime subscription for reactions
  useEffect(() => {
    if (!selectedRoomId) return;

    const reactionsChannel = supabase
      .channel('reactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions'
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newReaction = payload.new as any;
            setMessages(prev => prev.map(msg => {
              if (msg.id === newReaction.message_id) {
                const alreadyExists = msg.reactions?.some(
                  r => r.emoji === newReaction.emoji && r.user_id === newReaction.user_id
                );
                if (alreadyExists) return msg;
                return {
                  ...msg,
                  reactions: [...(msg.reactions || []), { emoji: newReaction.emoji, user_id: newReaction.user_id }]
                };
              }
              return msg;
            }));
          } else if (payload.eventType === 'DELETE') {
            const deletedReaction = payload.old as any;
            setMessages(prev => prev.map(msg => {
              if (msg.id === deletedReaction.message_id) {
                return {
                  ...msg,
                  reactions: msg.reactions?.filter(r => 
                    !(r.emoji === deletedReaction.emoji && r.user_id === deletedReaction.user_id)
                  )
                };
              }
              return msg;
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reactionsChannel);
    };
  }, [selectedRoomId]);

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
    if (!currentUser) {
      console.log('fetchConversations: No current user');
      return;
    }

    console.log('fetchConversations: Starting for user:', currentUser.id);

    try {
      // Step 1: Get room IDs for current user (avoids nested join that causes RLS circular dependency)
      const { data: userRooms, error: userRoomsError } = await supabase
        .from('room_participants')
        .select('room_id')
        .eq('user_id', currentUser.id);

      if (userRoomsError) {
        console.error('fetchConversations: Error fetching user rooms:', userRoomsError);
        throw userRoomsError;
      }

      console.log('fetchConversations: User rooms:', userRooms);

      if (!userRooms || userRooms.length === 0) {
        console.log('fetchConversations: No rooms found');
        setConversations([]);
        return;
      }

      const roomIds = userRooms.map(r => r.room_id);
      console.log('fetchConversations: Room IDs:', roomIds);

      // Step 2: Get chat_rooms data separately
      const { data: chatRooms, error: chatRoomsError } = await supabase
        .from('chat_rooms')
        .select('id, created_at, updated_at')
        .in('id', roomIds);

      if (chatRoomsError) {
        console.error('fetchConversations: Error fetching chat rooms:', chatRoomsError);
        throw chatRoomsError;
      }

      console.log('fetchConversations: Chat rooms:', chatRooms);

      // Step 3: Get other participants and their profiles separately
      const { data: otherParticipants, error: participantsError } = await supabase
        .from('room_participants')
        .select('room_id, user_id')
        .in('room_id', roomIds)
        .neq('user_id', currentUser.id);

      if (participantsError) {
        console.error('fetchConversations: Error fetching participants:', participantsError);
        throw participantsError;
      }

      console.log('fetchConversations: Other participants:', otherParticipants);

      if (!otherParticipants || otherParticipants.length === 0) {
        console.log('fetchConversations: No other participants found');
        setConversations([]);
        return;
      }

      // Step 4: Get profiles for other participants
      const otherUserIds = otherParticipants.map(p => p.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, profile_picture')
        .in('id', otherUserIds);

      if (profilesError) {
        console.error('fetchConversations: Error fetching profiles:', profilesError);
        throw profilesError;
      }

      console.log('fetchConversations: Profiles:', profiles);

      // Step 5: Get last messages for each room
      const { data: allMessages, error: messagesError } = await supabase
        .from('messages')
        .select('room_id, message, image_url, created_at')
        .in('room_id', roomIds)
        .order('created_at', { ascending: false });

      if (messagesError) {
        console.error('fetchConversations: Error fetching messages:', messagesError);
        throw messagesError;
      }

      console.log('fetchConversations: All messages:', allMessages);

      // Step 6: Combine results in frontend
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

      const conversationsArray = Array.from(conversationMap.values());
      console.log('fetchConversations: Final conversations array:', conversationsArray);
      
      setConversations(conversationsArray);
    } catch (error) {
      console.error('fetchConversations: Fatal error:', error);
      toast.error('Failed to load conversations');
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
        const typedMessages = await Promise.all((data as any[]).map(async (msg) => {
          const { data: reactions } = await supabase
            .from('message_reactions')
            .select('emoji, user_id')
            .eq('message_id', msg.id);
          
          return {
            id: msg.id,
            sender_id: msg.sender_id,
            receiver_id: msg.receiver_id,
            message: msg.message,
            image_url: msg.image_url,
            created_at: msg.created_at,
            room_id: msg.room_id,
            read_at: msg.read_at,
            reactions: reactions || []
          } as Message;
        }));

        if (loadMore) {
          setMessages([...typedMessages.reverse(), ...messages]);
          setHasMore(data.length === messageLimit);
        } else {
          setMessages(typedMessages.reverse());
          setHasMore(data.length === messageLimit);
          setTimeout(() => scrollToBottom(true), 100);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    }

    if (loadMore) setIsLoadingMore(false);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const threshold = 100;
    const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
    setIsAtBottom(isNearBottom);
    
    if (element.scrollTop === 0 && hasMore && !isLoadingMore) {
      const previousScrollHeight = element.scrollHeight;
      fetchMessages(true).then(() => {
        const newScrollHeight = element.scrollHeight;
        element.scrollTop = newScrollHeight - previousScrollHeight;
      });
    }
  };

  const scrollToBottom = (force = false) => {
    if (scrollAreaRef.current && (isAtBottom || force)) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  };

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

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser) return;
    
    try {
      const { data: existing } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', currentUser.id)
        .eq('emoji', emoji)
        .single();
      
      if (existing) {
        await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existing.id);
        
        // Remove reaction from state
        setMessages(prev => prev.map(msg => {
          if (msg.id === messageId) {
            return {
              ...msg,
              reactions: msg.reactions?.filter(r => !(r.emoji === emoji && r.user_id === currentUser.id))
            };
          }
          return msg;
        }));
      } else {
        await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            user_id: currentUser.id,
            emoji
          });
        
        // Add reaction to state
        setMessages(prev => prev.map(msg => {
          if (msg.id === messageId) {
            return {
              ...msg,
              reactions: [...(msg.reactions || []), { emoji, user_id: currentUser.id }]
            };
          }
          return msg;
        }));
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
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
      // Ensure we have a room
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
      fetchMessages();
      fetchConversations();
      setTimeout(() => scrollToBottom(true), 100);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error("Failed to send message");
    } finally {
      setUploading(false);
    }
  };

  const handleSelectConversation = async (userId: string, roomId: string | null) => {
    setSelectedConversation(userId);
    
    // If no roomId provided, try to get or create one
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
      <div className="container mx-auto px-4 py-4 flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl md:text-2xl font-bold">Messages</h1>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/feed')}
          >
            <Home className="h-4 w-4 mr-2" />
            Back to Feed
          </Button>
        </div>
        <div className="grid md:grid-cols-3 gap-4 md:gap-6 flex-1 overflow-hidden">
          <Card className={`shadow-card p-4 flex flex-col h-full overflow-hidden ${showConversations ? 'block' : 'hidden md:block'}`}>
            <h2 className="font-bold text-lg mb-4">Conversations</h2>
            <ScrollArea className="h-full">
              {conversations.map((conv) => (
                <div
                  key={conv.userId}
                  onClick={() => handleSelectConversation(conv.userId, conv.roomId)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer mb-2 transition-all hover:scale-[1.02] ${
                    selectedConversation === conv.userId
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "hover:bg-secondary/80"
                  }`}
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                      <AvatarImage src={conv.profilePicture || ""} />
                      <AvatarFallback className="text-sm font-semibold">
                        {conv.userName?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    {onlineUsers.has(conv.userId) && (
                      <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success border-2 border-background shadow-sm" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{conv.userName}</div>
                    <div className="text-xs truncate opacity-80">
                      {conv.lastMessage || "📷 Image"}
                    </div>
                  </div>
                </div>
              ))}
            </ScrollArea>
          </Card>

          <Card className={`md:col-span-2 shadow-card flex flex-col h-full overflow-hidden bg-gradient-to-br from-card to-card/95 ${showConversations ? 'hidden md:flex' : 'flex'}`}>
            {selectedConversation ? (
              <>
                <div className="p-3 md:p-4 border-b flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="md:hidden"
                    onClick={() => {
                      setShowConversations(true);
                      setSelectedConversation(null);
                    }}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedUserProfile?.profile_picture || ""} />
                      <AvatarFallback>
                        {selectedUserProfile?.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    {selectedConversation && onlineUsers.has(selectedConversation) && (
                      <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success border-2 border-background shadow-sm" />
                    )}
                  </div>
                  <div>
                    <h2 className="font-bold text-base md:text-lg">
                      {selectedUserProfile?.name || "User"}
                    </h2>
                    {selectedConversation && onlineUsers.has(selectedConversation) ? (
                      <p className="text-xs text-success font-medium">Online</p>
                    ) : selectedUserProfile?.rating > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Rating: {selectedUserProfile.rating.toFixed(1)} ⭐
                      </p>
                    ) : null}
                  </div>
                </div>
                <ScrollArea 
                  ref={scrollAreaRef} 
                  className="flex-1 overflow-y-auto p-3 md:p-4" 
                  style={{
                    background: `
                      linear-gradient(135deg, hsl(var(--secondary) / 0.03) 25%, transparent 25%),
                      linear-gradient(225deg, hsl(var(--secondary) / 0.03) 25%, transparent 25%),
                      linear-gradient(45deg, hsl(var(--secondary) / 0.03) 25%, transparent 25%),
                      linear-gradient(315deg, hsl(var(--secondary) / 0.03) 25%, hsl(var(--background)) 25%)
                    `,
                    backgroundPosition: '10px 0, 10px 0, 0 0, 0 0',
                    backgroundSize: '20px 20px',
                    backgroundColor: 'hsl(var(--background))'
                  }}
                  onScrollCapture={handleScroll}
                >
                  {isLoadingMore && (
                    <div className="text-center text-sm text-muted-foreground py-2">
                      Loading older messages...
                    </div>
                  )}
                  
                  {/* System Privacy Message */}
                  {messages.length > 0 && (
                    <div className="flex justify-center mb-6">
                      <div className="bg-muted/50 border border-border rounded-xl p-3 max-w-md text-center">
                        <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                          <span className="text-amber-500">⚠️</span>
                          <span>CampusLink may review messages for safety and quality. Keep conversations respectful and academic.</span>
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
                          <Avatar className="h-8 w-8 mt-1">
                            <AvatarImage src={selectedUserProfile?.profile_picture || ""} />
                            <AvatarFallback className="text-xs">
                              {selectedUserProfile?.name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="flex flex-col max-w-[85%]">
                          <div
                            className={`max-w-[85%] sm:max-w-[75%] md:max-w-md p-3 transition-all ${
                              msg.sender_id === currentUser?.id
                                ? "bg-gradient-primary text-primary-foreground rounded-2xl rounded-br-md shadow-md"
                                : "bg-secondary rounded-2xl rounded-bl-md shadow-sm hover:shadow-md"
                            }`}
                          >
                            {msg.image_url && (
                              <img 
                                src={msg.image_url} 
                                alt="Message attachment" 
                                className="rounded-lg max-w-[250px] md:max-w-[300px] max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity mb-2"
                                onClick={() => window.open(msg.image_url!, '_blank')}
                              />
                            )}
                            {msg.message && <p className={`text-sm md:text-base ${msg.image_url ? 'mt-2' : ''}`}>{msg.message}</p>}
                          </div>
                          
                          {/* Reactions display - OUTSIDE bubble */}
                          {msg.reactions && msg.reactions.length > 0 && (
                            <div className={`flex gap-1 mt-1 flex-wrap ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}>
                              {Object.entries(
                                msg.reactions.reduce((acc, r) => {
                                  if (!acc[r.emoji]) acc[r.emoji] = [];
                                  acc[r.emoji].push(r.user_id);
                                  return acc;
                                }, {} as Record<string, string[]>)
                              ).map(([emoji, userIds]) => {
                                const count = userIds.length;
                                const hasReacted = userIds.includes(currentUser?.id || '');
                                return (
                                  <button
                                    key={emoji}
                                    className={`px-2 py-1 text-sm rounded-full transition-all hover:scale-110 ${
                                      hasReacted
                                        ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/50'
                                        : 'bg-secondary/80 hover:bg-secondary'
                                    }`}
                                    onClick={() => toggleReaction(msg.id, emoji)}
                                    title={hasReacted ? 'Remove reaction' : 'React'}
                                  >
                                    {emoji} {count > 1 ? count : ''}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          
                          {/* Quick reaction buttons - OUTSIDE bubble, show on hover */}
                          <div className={`flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}>
                            {['❤️', '😂', '👍', '🔥', '😮'].map(emoji => (
                              <button
                                key={emoji}
                                className="text-base hover:scale-125 transition-transform bg-background/90 rounded-full w-7 h-7 flex items-center justify-center shadow-sm hover:shadow-md border border-border/50"
                                onClick={() => toggleReaction(msg.id, emoji)}
                                title={`React with ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                          
                          {msg.sender_id === currentUser?.id && (
                            <div className="flex items-center gap-1 mt-1 justify-end">
                              {msg.read_at ? (
                                <>
                                  <CheckCheck className="h-3 w-3 text-primary" />
                                  <span className="text-xs text-primary font-medium">Read</span>
                                </>
                              ) : (
                                <>
                                  <Check className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">Delivered</span>
                                </>
                              )}
                            </div>
                          )}
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
                <div className="p-3 md:p-4 border-t flex gap-2 bg-background">
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
                    className="rounded-full hover:bg-secondary"
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
                    placeholder="Type a message..."
                    onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                    disabled={uploading}
                    className="flex-1 rounded-full border-2 focus-visible:ring-offset-0 shadow-sm focus:shadow-md transition-shadow"
                  />
                  <Button 
                    onClick={sendMessage} 
                    disabled={uploading || (!newMessage.trim() && !selectedImage)}
                    className="rounded-full h-10 w-10 p-0 shadow-primary hover:shadow-lg"
                    size="icon"
                    variant="default"
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
    </div>
  );
};

export default Messages;
