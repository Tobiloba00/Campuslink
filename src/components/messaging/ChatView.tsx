import { useEffect, useRef, memo } from "react";
import { MessageBubble } from "./MessageBubble";
import { groupMessagesByDate } from "./utils";
import { Message, UserProfile } from "./types";
import { useDebouncedCallback } from "use-debounce";
import { Loader2 } from "lucide-react";

interface ChatViewProps {
  messages: Message[];
  currentUserId: string;
  selectedUserProfile: UserProfile | null;
  typingUsers: Set<string>;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

export const ChatView = memo(({
  messages,
  currentUserId,
  selectedUserProfile,
  typingUsers,
  hasMore,
  isLoadingMore,
  onLoadMore
}: ChatViewProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // Group messages for rendering
  const messageGroups = groupMessagesByDate(messages);

  // Auto-scroll logic strictly tied to message array changes
  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    
    if (isAtBottomRef.current) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages.length]); // Only run when total number of messages changes

  // Infinite scroll detector
  const handleScroll = useDebouncedCallback(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;

    const threshold = 100;
    isAtBottomRef.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < threshold;

    if (viewport.scrollTop < 50 && hasMore && !isLoadingMore) {
      const currentHeight = viewport.scrollHeight;
      onLoadMore(); // Parent needs to preserve scroll position via Promise or layout effect
      
      // Attempt to preserve scroll position instantly assuming network request is immediate
      // A better way is handled in the parent when messages actually update
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight - currentHeight;
        }
      }, 50);
    }
  }, 100);

  return (
    <div 
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 relative hide-scrollbar"
      style={{
        backgroundImage: 'url("/chat-bg.png")',
        backgroundSize: '400px',
        backgroundRepeat: 'repeat',
        backgroundColor: 'hsl(var(--background) / 0.96)',
        backgroundBlendMode: 'overlay'
      }}
    >
      {/* End to end encryption notice */}
      {messages.length > 0 && (
        <div className="flex justify-center mb-8 animate-in fade-in duration-1000">
          <div className="bg-muted/40 backdrop-blur-md border border-border/50 rounded-2xl px-4 py-2 max-w-sm text-center shadow-sm">
            <p className="text-[11px] sm:text-xs text-muted-foreground/80 font-medium tracking-tight">
              🔒 End-to-end conversations • Keep it respectful
            </p>
          </div>
        </div>
      )}

      {/* Loading indicator for older messages */}
      {isLoadingMore && (
        <div className="flex justify-center py-4 mb-4">
          <div className="bg-background/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-border/50 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Loading older messages...</span>
          </div>
        </div>
      )}

      {/* Messages rendering */}
      <div className="flex flex-col gap-1 pb-4">
        {messageGroups.map((group) => (
          <div key={group.date} className="animate-in fade-in duration-500">
            <div className="flex justify-center my-6 sticky top-2 z-10 transition-opacity">
              <span className="bg-background/85 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-muted-foreground uppercase tracking-widest border border-border/50 shadow-sm">
                {group.date}
              </span>
            </div>

            {group.messages.map((msg, index) => {
              const prevMsg = index > 0 ? group.messages[index - 1] : null;
              const nextMsg = index < group.messages.length - 1 ? group.messages[index + 1] : null;
              
              const isFirstInSequence = !prevMsg || prevMsg.sender_id !== msg.sender_id;
              const isLastInSequence = !nextMsg || nextMsg.sender_id !== msg.sender_id;

              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isMe={msg.sender_id === currentUserId}
                  isFirstInSequence={isFirstInSequence}
                  isLastInSequence={isLastInSequence}
                  userProfile={selectedUserProfile}
                  currentUserId={currentUserId}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Typing indicator */}
      {typingUsers.size > 0 && selectedUserProfile && typingUsers.has(selectedUserProfile.id) && (
        <div className="flex items-center gap-3 animate-in slide-in-from-bottom-2 fade-in mt-4 ml-6 sm:ml-12">
          <div className="bg-card border border-border/40 rounded-2xl p-3 shadow-sm inline-flex rounded-tl-none relative w-16 h-9">
            <div className="absolute top-0 left-[-6px] w-3 h-3 bg-card border-l border-t border-border/40 clip-path-tail-left" />
            <div className="flex gap-1.5 items-center justify-center w-full">
              <span className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce"></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ChatView.displayName = 'ChatView';
