import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { MessageSquare, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams, useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";

import { CurrentUser, UserProfile, ReplyContext } from "@/components/messaging/types";
import { useMessaging } from "@/hooks/useMessaging";
import { usePresence } from "@/hooks/usePresence";
import { ConversationList } from "@/components/messaging/ConversationList";
import { ChatHeader } from "@/components/messaging/ChatHeader";
import { ChatView } from "@/components/messaging/ChatView";
import { MessageInput } from "@/components/messaging/MessageInput";

const Messages = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [initialRouteHandled, setInitialRouteHandled] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyContext | null>(null);

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
    setSelectedConversation,

    fetchConversations,
    selectConversation,
    sendMessage,
    retryMessage,
    loadMoreMessages,
    fetchPostContext,
    fetchAiSuggestions,
    toggleReaction
  } = useMessaging(currentUser?.id);

  const { onlineUsers, typingUsers, sendTypingIndicator } = usePresence({
    roomId: selectedRoomId,
    currentUserId: currentUser?.id || null
  });

  // ─── Network listeners ───
  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); toast.success("Back online"); };
    const handleOffline = () => { setIsOnline(false); toast.error("You're offline"); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ─── Auth check ───
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUser(prev => prev?.id === user.id ? prev : user);
      } else {
        navigate('/auth');
      }
    });
  }, [navigate]);

  // ─── Load conversations when user is ready ───
  useEffect(() => {
    if (currentUser) fetchConversations();
  }, [currentUser, fetchConversations]);

  // ─── Handle URL params for deep linking ───
  useEffect(() => {
    if (!currentUser || initialRouteHandled) return;

    const userIdParam = searchParams.get('userId');
    const postIdParam = searchParams.get('postId');

    if (userIdParam) {
      setInitialRouteHandled(true);
      selectConversation(userIdParam, null).then(async () => {
        if (postIdParam) {
          const post = await fetchPostContext(postIdParam);
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
                currentUser.user_metadata?.full_name || 'A Student'
              );
            }
          }
        }
      });
    } else {
      setInitialRouteHandled(true);
    }
  }, [currentUser, searchParams, initialRouteHandled, selectConversation, fetchPostContext, fetchAiSuggestions]);

  // ─── Clear reply when switching conversations ───
  useEffect(() => {
    setReplyTo(null);
  }, [selectedConversation]);

  // ─── Handlers ───
  const handleBackToConversations = () => {
    setSelectedConversation(null);
    setReplyTo(null);
  };

  const handleSendMessage = async (text: string, file: File | null, preview: string | null) => {
    await sendMessage(text, file, preview);
  };

  const handleSelectAiSuggestion = (suggestion: string) => {
    sendMessage(suggestion, null, null);
    setAiSuggestions([]);
  };

  const isChatOpen = selectedConversation !== null;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Navbar />

      <div className="flex-1 flex flex-col overflow-hidden pt-14 pb-[68px] lg:pb-0">
        {/* Offline banner */}
        {!isOnline && (
          <div className="flex items-center justify-center gap-2 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs font-semibold">
            <WifiOff className="h-3.5 w-3.5" />
            <span>You're offline — messages will send when reconnected</span>
          </div>
        )}

        {/* Main layout */}
        <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto">
          {/* Conversation List Panel */}
          <div className={`w-full md:w-[380px] lg:w-[400px] flex-shrink-0 border-r border-border/50 ${isChatOpen ? 'hidden md:flex' : 'flex'} flex-col overflow-hidden`}>
            <ConversationList
              conversations={conversations}
              selectedConversation={selectedConversation}
              onSelectConversation={selectConversation}
              isLoading={isLoadingConversations}
              onlineUsers={onlineUsers}
              showOnMobile={!isChatOpen}
            />
          </div>

          {/* Chat Panel */}
          <div className={`flex-1 flex flex-col overflow-hidden ${!isChatOpen ? 'hidden md:flex' : 'flex'}`}>
            {isChatOpen && selectedUserProfile ? (
              <>
                <ChatHeader
                  userProfile={selectedUserProfile}
                  isOnline={onlineUsers.has(selectedConversation!)}
                  onBack={handleBackToConversations}
                />

                <ChatView
                  messages={messages}
                  currentUserId={currentUser?.id || ''}
                  selectedUserProfile={selectedUserProfile}
                  typingUsers={typingUsers}
                  hasMore={hasMore}
                  isLoadingMore={isLoadingMore}
                  onLoadMore={loadMoreMessages}
                  onRetryMessage={retryMessage}
                  onReact={toggleReaction}
                  onSetReplyTo={setReplyTo}
                />

                <MessageInput
                  isOffline={!isOnline}
                  onSendMessage={handleSendMessage}
                  onTyping={sendTypingIndicator}
                  postContext={postContext}
                  onClearPostContext={() => setPostContext(null)}
                  aiSuggestions={aiSuggestions}
                  onSelectAiSuggestion={handleSelectAiSuggestion}
                  messagesCount={messages.length}
                  replyTo={replyTo}
                  onClearReply={() => setReplyTo(null)}
                />
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center chat-background-empty">
                <div className="h-20 w-20 rounded-3xl bg-primary/5 flex items-center justify-center mb-6 border border-primary/10">
                  <MessageSquare className="h-10 w-10 text-primary/30" />
                </div>
                <h3 className="text-xl font-bold text-foreground/80 mb-2">Your Messages</h3>
                <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">
                  Select a conversation to start chatting, or message someone from the feed.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Messages;
