import { useEffect, useRef, useState, useCallback, memo } from "react";
import { MessageBubble } from "./MessageBubble";
import { groupMessagesByDate } from "./utils";
import { Message, UserProfile, ReplyContext } from "./types";
import { Loader2, ChevronDown, Lock } from "lucide-react";
import { ImageLightbox } from "./ImageLightbox";

interface ChatViewProps {
  messages: Message[];
  currentUserId: string;
  selectedUserProfile: UserProfile | null;
  typingUsers: Set<string>;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onRetryMessage: (msg: Message) => void;
  onReact: (messageId: string, emoji: string) => void;
  onSetReplyTo: (ctx: ReplyContext | null) => void;
}

export const ChatView = memo(({
  messages,
  currentUserId,
  selectedUserProfile,
  typingUsers,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onRetryMessage,
  onReact,
  onSetReplyTo
}: ChatViewProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const prevScrollHeightRef = useRef(0);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const messageGroups = groupMessagesByDate(messages);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const prevCount = prevMessageCountRef.current;
    const newCount = messages.length;
    prevMessageCountRef.current = newCount;

    if (newCount === 0) return;

    if (prevCount === 0 && newCount > 0) {
      requestAnimationFrame(() => scrollToBottom());
      return;
    }

    if (newCount > prevCount && prevCount > 0) {
      const wasLoadMore = newCount - prevCount > 5;
      if (wasLoadMore) {
        requestAnimationFrame(() => {
          if (el) {
            const heightDiff = el.scrollHeight - prevScrollHeightRef.current;
            el.scrollTop = heightDiff;
          }
        });
      } else if (isAtBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom('smooth'));
      }
    }

    prevScrollHeightRef.current = el.scrollHeight;
  }, [messages.length, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distanceFromBottom < 120;
    setShowScrollButton(distanceFromBottom > 300);

    if (el.scrollTop < 60 && hasMore && !isLoadingMore) {
      prevScrollHeightRef.current = el.scrollHeight;
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  const handleReply = useCallback((msg: Message) => {
    onSetReplyTo({
      messageId: msg.id,
      senderName: msg.sender_id === currentUserId ? 'You' : (selectedUserProfile?.name || 'User'),
      text: msg.message,
      imageUrl: msg.image_url
    });
  }, [currentUserId, selectedUserProfile, onSetReplyTo]);

  const isTyping = typingUsers.size > 0 && selectedUserProfile && typingUsers.has(selectedUserProfile.id);

  return (
    <div className="flex-1 relative overflow-hidden">
      {/* Chat background pattern */}
      <div className="absolute inset-0 chat-background pointer-events-none" />

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-3 sm:px-4 md:px-5 py-4 relative z-[1]"
      >
        {/* Encryption notice */}
        {messages.length > 0 && (
          <div className="flex justify-center mb-5">
            <div className="bg-amber-500/10 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <Lock className="h-3 w-3" />
              <p className="text-[10px] font-medium tracking-tight">
                Messages are private and secure
              </p>
            </div>
          </div>
        )}

        {/* Load more */}
        {isLoadingMore && (
          <div className="flex justify-center py-3 mb-3">
            <div className="bg-background/80 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2 border border-border/30 shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Loading older messages...</span>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex flex-col">
          {messageGroups.map((group) => (
            <div key={group.date}>
              <div className="flex justify-center my-4 sticky top-1 z-10">
                <span className="bg-background/85 backdrop-blur-sm px-3 py-1 rounded-lg text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border border-border/30 shadow-sm">
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
                    key={msg.tempId || msg.id}
                    message={msg}
                    isMe={msg.sender_id === currentUserId}
                    isFirstInSequence={isFirstInSequence}
                    isLastInSequence={isLastInSequence}
                    userProfile={selectedUserProfile}
                    currentUserId={currentUserId}
                    onRetry={() => onRetryMessage(msg)}
                    onReact={onReact}
                    onReply={handleReply}
                    onImageClick={setLightboxSrc}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-center gap-1.5 mt-3 ml-9">
            <div className="chat-bubble-other rounded-2xl rounded-bl-sm px-4 py-2.5">
              <div className="flex gap-1 items-center">
                <span className="h-2 w-2 bg-current opacity-40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="h-2 w-2 bg-current opacity-40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="h-2 w-2 bg-current opacity-40 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}

        <div className="h-2" />
      </div>

      {/* Scroll to bottom */}
      {showScrollButton && (
        <button
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-4 right-4 h-10 w-10 rounded-full bg-background border border-border/50 shadow-lg flex items-center justify-center hover:bg-muted transition-all hover:scale-105 active:scale-95 z-20"
        >
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        </button>
      )}

      {/* Image lightbox */}
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </div>
  );
});

ChatView.displayName = 'ChatView';
