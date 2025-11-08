import { useEffect, useState, useRef } from "react";
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });
    
    const userId = searchParams.get('userId');
    if (userId) {
      setSelectedConversation(userId);
    }
  }, [searchParams]);

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
          () => fetchMessages()
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
    if (!currentUser) return;

    const { data } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(name, profile_picture),
        receiver:profiles!messages_receiver_id_fkey(name, profile_picture)
      `)
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
      .order('created_at', { ascending: false });

    if (!data) return;

    const conversationMap = new Map<string, Conversation>();

    data.forEach((msg: any) => {
      const otherUserId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
      const otherUserName = msg.sender_id === currentUser.id ? msg.receiver.name : msg.sender.name;
      const otherUserPicture = msg.sender_id === currentUser.id ? msg.receiver.profile_picture : msg.sender.profile_picture;

      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, {
          userId: otherUserId,
          userName: otherUserName,
          lastMessage: msg.message,
          timestamp: msg.created_at,
          profilePicture: otherUserPicture,
          roomId: msg.room_id
        });
      }
    });

    setConversations(Array.from(conversationMap.values()));
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
    if (!currentUser || !selectedConversation) return;
    if (loadMore && (!hasMore || isLoadingMore)) return;

    if (loadMore) setIsLoadingMore(true);

    let query = supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedConversation}),and(sender_id.eq.${selectedConversation},receiver_id.eq.${currentUser.id})`
      )
      .order('created_at', { ascending: false })
      .limit(messageLimit);

    if (loadMore && messages.length > 0) {
      const oldestMessage = messages[0];
      query = query.lt('created_at', oldestMessage.created_at);
    }

    const { data } = await query;

    if (data) {
      const typedMessages = (data as any[]).map(msg => ({
        id: msg.id,
        sender_id: msg.sender_id,
        receiver_id: msg.receiver_id,
        message: msg.message,
        image_url: msg.image_url,
        created_at: msg.created_at,
        room_id: msg.room_id || null,
        read_at: msg.read_at || null
      })) as Message[];

      if (loadMore) {
        setMessages([...typedMessages.reverse(), ...messages]);
        setHasMore(data.length === messageLimit);
      } else {
        setMessages(typedMessages.reverse());
        setHasMore(data.length === messageLimit);
        setTimeout(scrollToBottom, 100);
      }
    }

    if (loadMore) setIsLoadingMore(false);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    if (element.scrollTop === 0 && hasMore && !isLoadingMore) {
      const previousScrollHeight = element.scrollHeight;
      fetchMessages(true).then(() => {
        // Maintain scroll position
        const newScrollHeight = element.scrollHeight;
        element.scrollTop = newScrollHeight - previousScrollHeight;
      });
    }
  };

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
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
    if ((!newMessage.trim() && !selectedImage) || !currentUser || !selectedConversation || !selectedRoomId) return;

    setUploading(true);
    try {
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
          room_id: selectedRoomId
        } as any);

      if (error) throw error;

      setNewMessage("");
      clearImage();
      fetchMessages();
      fetchConversations();
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setUploading(false);
    }
  };

  const handleSelectConversation = (userId: string, roomId: string) => {
    setSelectedConversation(userId);
    setSelectedRoomId(roomId);
    setShowConversations(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-4 md:py-8">
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
        <div className="grid md:grid-cols-3 gap-4 md:gap-6 h-[calc(100vh-12rem)] md:h-[600px]">
          <Card className={`shadow-card p-4 ${showConversations ? 'block' : 'hidden md:block'}`}>
            <h2 className="font-bold text-lg mb-4">Conversations</h2>
            <ScrollArea className="h-[calc(100vh-12rem)] md:h-[500px]">
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

          <Card className={`md:col-span-2 shadow-card flex flex-col ${showConversations ? 'hidden md:flex' : 'flex'}`}>
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
                <ScrollArea ref={scrollAreaRef} className="flex-1 p-3 md:p-4" onScrollCapture={handleScroll}>
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

                  <div className="space-y-3 md:space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-2 ${
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
                        <div className="flex flex-col">
                          <div
                            className={`max-w-[75%] md:max-w-[70%] p-2 md:p-3 transition-all ${
                              msg.sender_id === currentUser?.id
                                ? "bg-gradient-primary text-primary-foreground rounded-[18px] rounded-br-md shadow-primary"
                                : "bg-secondary rounded-[18px] rounded-bl-md shadow-sm hover:shadow-md"
                            }`}
                          >
                            {msg.message && <p className="text-sm md:text-base">{msg.message}</p>}
                            {msg.image_url && (
                              <img 
                                src={msg.image_url} 
                                alt="Message attachment" 
                                className="mt-2 rounded-lg max-w-[250px] md:max-w-[300px] max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(msg.image_url!, '_blank')}
                              />
                            )}
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
