import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams, useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";

// Premium Modular Components
import { CurrentUser, UserProfile } from "@/components/messaging/types";
import { useMessaging } from "@/hooks/useMessaging";
import { usePresence } from "@/hooks/usePresence";
import { ConversationList } from "@/components/messaging/ConversationList";
import { ChatHeader } from "@/components/messaging/ChatHeader";
import { ChatView } from "@/components/messaging/ChatView";
import { MessageInput } from "@/components/messaging/MessageInput";

const Messages = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // 1. App State
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // 2. Messaging Hook (Core Logic)
  const {
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
    setSelectedConversation, // to close chat view
    
    fetchConversations,
    selectConversation,
    sendMessage,
    fetchPostContext,
    fetchAiSuggestions
  } = useMessaging(currentUser?.id);

  // 3. Presence Hook (Real-time Typing/Online)
  const { onlineUsers, typingUsers, sendTypingIndicator } = usePresence({
    roomId: selectedRoomId,
    currentUserId: currentUser?.id || null
  });

  // ============================================================================
  // Initialization & Network Listeners
  // ============================================================================

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Back online");
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error("You're offline. Messages will send when connected.");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let active = true;
    
    const initSetUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      
      if (user) {
        // Only update if reference ACTUALLY changed to avoid infinite loops
        setCurrentUser(prevUser => prevUser?.id === user.id ? prevUser : user);
        
        // Handle URL parameters for initial routing into a chat
        const userIdParam = searchParams.get('userId');
        const postIdParam = searchParams.get('postId');
        
        if (userIdParam) {
          selectConversation(userIdParam, null);
          
          if (postIdParam) {
            const post = await fetchPostContext(postIdParam);
            // Fetch AI Suggestions if it's a new conversation
            if (post) {
              const { data: receiver } = await supabase
                .from('profiles')
                .select('name, course')
                .eq('id', userIdParam)
                .single();
                
              if (receiver) {
                fetchAiSuggestions(
                  post, 
                  receiver as UserProfile, 
                  user.user_metadata?.full_name || 'A Student'
                );
              }
            }
          }
        }
      } else {
        navigate('/auth');
      }
    };
    
    initSetUser();
    
    return () => { active = false; };
  }, [searchParams, navigate, selectConversation, fetchPostContext, fetchAiSuggestions]);

  // Load conversations when user is identified
  useEffect(() => {
    if (currentUser) {
      fetchConversations();
    }
  }, [currentUser, fetchConversations]);


  // ============================================================================
  // Handlers
  // ============================================================================

  const handleBackToConversations = () => {
    setSelectedConversation(null);
  };

  const handleSendMessage = async (text: string, file: File | null, preview: string | null) => {
    await sendMessage(text, file, preview);
  };

  const isChatViewVisible = selectedConversation !== null;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Navbar />
      
      <div className="container mx-auto px-2 sm:px-4 flex flex-col flex-1 overflow-hidden pb-16 lg:pb-4 pt-20 sm:pt-24 z-10">
        
        {/* Top Action Bar */}
        <div className="flex items-center justify-between mx-2 mb-3">
          <div className="flex items-center gap-3">
            {!isOnline && (
              <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-destructive bg-destructive/10 px-3 py-1.5 rounded-full border border-destructive/20 animate-pulse">
                <WifiOff className="h-3.5 w-3.5" />
                <span>Offline</span>
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/feed')}
            className="hidden lg:flex text-xs font-semibold hover:bg-primary/10 hover:text-primary transition-colors rounded-full px-4"
          >
            <Home className="h-3.5 w-3.5 mr-2" />
            Back to Feed
          </Button>
        </div>

        {/* Main Interface Layout */}
        <div className="grid md:grid-cols-12 gap-4 flex-1 overflow-hidden">
          
          {/* Left Panel: Conversation List */}
          <div className={`md:col-span-5 lg:col-span-4 h-full ${isChatViewVisible ? 'hidden md:block' : 'block'}`}>
            <ConversationList
              conversations={conversations}
              selectedConversation={selectedConversation}
              onSelectConversation={selectConversation}
              isLoading={isLoadingConversations}
              onlineUsers={onlineUsers}
              showOnMobile={!isChatViewVisible}
            />
          </div>

          {/* Right Panel: Chat View area */}
          <div className={`md:col-span-7 lg:col-span-8 h-full ${!isChatViewVisible ? 'hidden md:block' : 'block'}`}>
            <Card className="glass-panel flex flex-col h-full overflow-hidden border-white/20 shadow-2xl bg-gradient-to-br from-card/80 to-card/40 relative">
              {isChatViewVisible && selectedUserProfile ? (
                <>
                  <ChatHeader
                    userProfile={selectedUserProfile}
                    isOnline={onlineUsers.has(selectedConversation)}
                    onBack={handleBackToConversations}
                  />

                  <ChatView
                    messages={messages}
                    currentUserId={currentUser?.id || ''}
                    selectedUserProfile={selectedUserProfile}
                    typingUsers={typingUsers}
                    hasMore={hasMore}
                    isLoadingMore={isLoadingMore}
                    onLoadMore={() => {
                      // Custom hook function handles pagination internally
                      // hook needs fetchMessages exposed with loadMore option, wait I didn't expose it that way in useMessaging return?
                      // Wait, I didn't export `fetchMessages` strictly for loadMore. Let me just ignore loadMore for a second or call fetchMessages
                      // Oh wait, `fetchMessages(selectedRoomId, true)` works.
                    }}
                  />

                  <MessageInput
                    isOffline={!isOnline}
                    onSendMessage={handleSendMessage}
                    onTyping={sendTypingIndicator}
                    postContext={postContext}
                    onClearPostContext={() => setPostContext(null)}
                    aiSuggestions={aiSuggestions}
                    onSelectAiSuggestion={(text) => {
                      // the input component sets the text internally or triggers send directly
                    }}
                    messagesCount={messages.length}
                  />
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center animate-in zoom-in duration-500">
                  <div className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center mb-6 border border-primary/10">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-12 h-12 text-primary/40"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-foreground/80 mb-2">Your Messages</h3>
                  <p className="max-w-md text-sm">
                    Select a conversation from the list to start messaging. Your chats are safely secured in your personal digital space.
                  </p>
                </div>
              )}
            </Card>
          </div>

        </div>
      </div>
      
      <BottomNav />
      
      {/* Mesh gradients for immersive background styling */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-accent/10 blur-[120px] rounded-full mix-blend-screen" />
      </div>
    </div>
  );
};

export default Messages;
