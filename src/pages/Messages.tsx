import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, X, Image as ImageIcon, ArrowLeft, Home } from "lucide-react";
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
};

type Conversation = {
  userId: string;
  userName: string;
  lastMessage: string;
  timestamp: string;
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
    if (selectedConversation && currentUser) {
      fetchMessages();
      fetchUserProfile();

      const channel = supabase
        .channel('messages-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
          },
          () => fetchMessages()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedConversation, currentUser]);

  const fetchConversations = async () => {
    if (!currentUser) return;

    const { data } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(name),
        receiver:profiles!messages_receiver_id_fkey(name)
      `)
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
      .order('created_at', { ascending: false });

    if (!data) return;

    const conversationMap = new Map<string, Conversation>();

    data.forEach((msg: any) => {
      const otherUserId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
      const otherUserName = msg.sender_id === currentUser.id ? msg.receiver.name : msg.sender.name;

      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, {
          userId: otherUserId,
          userName: otherUserName,
          lastMessage: msg.message,
          timestamp: msg.created_at
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

  const fetchMessages = async () => {
    if (!currentUser || !selectedConversation) return;

    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedConversation}),and(sender_id.eq.${selectedConversation},receiver_id.eq.${currentUser.id})`
      )
      .order('created_at', { ascending: true });

    setMessages(data || []);
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

  const sendMessage = async () => {
    if ((!newMessage.trim() && !selectedImage) || !currentUser || !selectedConversation) return;

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
          image_url: imageUrl
        });

      if (error) throw error;

      setNewMessage("");
      clearImage();
      fetchMessages();
      fetchConversations();
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setUploading(false);
    }
  };

  const handleSelectConversation = (userId: string) => {
    setSelectedConversation(userId);
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
                  onClick={() => handleSelectConversation(conv.userId)}
                  className={`p-3 rounded-lg cursor-pointer mb-2 transition-colors ${
                    selectedConversation === conv.userId
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-secondary"
                  }`}
                >
                  <div className="font-medium">{conv.userName}</div>
                  <div className="text-sm truncate opacity-80">{conv.lastMessage || "Image"}</div>
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
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedUserProfile?.profile_picture || ""} />
                    <AvatarFallback>
                      {selectedUserProfile?.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="font-bold text-base md:text-lg">
                      {selectedUserProfile?.name || "User"}
                    </h2>
                    {selectedUserProfile?.rating > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Rating: {selectedUserProfile.rating.toFixed(1)} ⭐
                      </p>
                    )}
                  </div>
                </div>
                <ScrollArea className="flex-1 p-3 md:p-4">
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
                        <div
                          className={`max-w-[75%] md:max-w-[70%] p-2 md:p-3 rounded-lg ${
                            msg.sender_id === currentUser?.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary"
                          }`}
                        >
                          {msg.message && <p className="text-sm md:text-base">{msg.message}</p>}
                          {msg.image_url && (
                            <img 
                              src={msg.image_url} 
                              alt="Message attachment" 
                              className="mt-2 rounded max-w-full h-auto cursor-pointer hover:opacity-90"
                              onClick={() => window.open(msg.image_url!, '_blank')}
                            />
                          )}
                        </div>
                      </div>
                    ))}
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
                <div className="p-3 md:p-4 border-t flex gap-2">
                  <input
                    type="file"
                    id="message-image"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect}
                    disabled={uploading}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => document.getElementById('message-image')?.click()}
                    disabled={uploading}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                    disabled={uploading}
                    className="flex-1"
                  />
                  <Button onClick={sendMessage} disabled={uploading || (!newMessage.trim() && !selectedImage)}>
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
