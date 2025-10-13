import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import { toast } from "sonner";

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
};

type Conversation = {
  userId: string;
  userName: string;
  lastMessage: string;
  timestamp: string;
};

const Messages = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchConversations();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedConversation && currentUser) {
      fetchMessages();

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

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !selectedConversation) return;

    const { error } = await supabase
      .from('messages')
      .insert({
        sender_id: currentUser.id,
        receiver_id: selectedConversation,
        message: newMessage
      });

    if (error) {
      toast.error("Failed to send message");
      return;
    }

    setNewMessage("");
    fetchMessages();
    fetchConversations();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-6 h-[600px]">
          <Card className="shadow-card p-4">
            <h2 className="font-bold text-lg mb-4">Conversations</h2>
            <ScrollArea className="h-[500px]">
              {conversations.map((conv) => (
                <div
                  key={conv.userId}
                  onClick={() => setSelectedConversation(conv.userId)}
                  className={`p-3 rounded-lg cursor-pointer mb-2 transition-colors ${
                    selectedConversation === conv.userId
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-secondary"
                  }`}
                >
                  <div className="font-medium">{conv.userName}</div>
                  <div className="text-sm truncate opacity-80">{conv.lastMessage}</div>
                </div>
              ))}
            </ScrollArea>
          </Card>

          <Card className="md:col-span-2 shadow-card flex flex-col">
            {selectedConversation ? (
              <>
                <div className="p-4 border-b">
                  <h2 className="font-bold text-lg">
                    {conversations.find((c) => c.userId === selectedConversation)?.userName}
                  </h2>
                </div>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.sender_id === currentUser?.id ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[70%] p-3 rounded-lg ${
                            msg.sender_id === currentUser?.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary"
                          }`}
                        >
                          {msg.message}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="p-4 border-t flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                  />
                  <Button onClick={sendMessage}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
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
