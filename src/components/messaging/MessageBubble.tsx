import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, CheckCheck, Loader2, Copy, RotateCcw, SmilePlus, Reply } from "lucide-react";
import { Message, UserProfile, ReplyContext } from './types';
import { formatMessageTime, detectLinks } from "./utils";
import { useState, memo, useRef, useEffect } from 'react';
import { toast } from "sonner";
import { ReactionPicker } from "./ReactionPicker";

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  isFirstInSequence: boolean;
  isLastInSequence: boolean;
  userProfile: UserProfile | null;
  currentUserId: string;
  onRetry: () => void;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (msg: Message) => void;
  onImageClick: (src: string) => void;
}

export const MessageBubble = memo(({
  message,
  isMe,
  isFirstInSequence,
  isLastInSequence,
  userProfile,
  currentUserId,
  onRetry,
  onReact,
  onReply,
  onImageClick
}: MessageBubbleProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const isFailed = message.status === 'failed';
  const isSending = message.status === 'sending';
  const hasReactions = message.reactions && message.reactions.length > 0;

  const renderMessageContent = (text: string) => {
    if (!text) return null;
    const links = detectLinks(text);

    if (links.length === 0) {
      return <p className="chat-text leading-[1.55] break-words whitespace-pre-wrap">{text}</p>;
    }

    const parts = text.split(/(https?:\/\/[^\s]+)/g);
    return (
      <p className="chat-text leading-[1.55] break-words whitespace-pre-wrap">
        {parts.map((part, i) => {
          if (part.match(/https?:\/\/[^\s]+/)) {
            return (
              <a
                key={i}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 opacity-90 hover:opacity-100 break-all font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                {part}
              </a>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </p>
    );
  };

  const copyMessage = () => {
    if (message.message) {
      navigator.clipboard.writeText(message.message);
      toast.success("Copied");
    }
  };

  const getStatusIcon = () => {
    if (!isMe) return null;
    switch (message.status) {
      case 'sending':
        return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/60" />;
      case 'failed':
        return <span className="text-[10px] text-destructive font-bold">!</span>;
      default:
        return message.read_at
          ? <CheckCheck className="h-3.5 w-3.5 text-primary" />
          : <Check className="h-3.5 w-3.5 text-muted-foreground/50" />;
    }
  };

  // Reply preview inside bubble
  const replyTo = message.replyTo;

  // ─── Swipe-to-reply (mobile, WhatsApp-style) ───
  // Received messages: drag right. Sent messages: drag left.
  const SWIPE_TRIGGER = 60;   // px drag distance to trigger reply
  const MAX_DRAG = 100;       // visual cap so the bubble doesn't fly across the screen
  const ACTIVATION = 8;       // ignored micro-movement before deciding intent

  const rowRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<{
    startX: number;
    startY: number;
    locked: boolean;          // committed to a horizontal drag
    crossedThreshold: boolean;
  } | null>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const direction = isMe ? -1 : 1; // expected sign of dx for a valid swipe

    const onTouchStart = (e: TouchEvent) => {
      // Don't start if message is mid-send / failed (no point replying yet)
      if (isSending || isFailed) return;
      const t = e.touches[0];
      touchRef.current = { startX: t.clientX, startY: t.clientY, locked: false, crossedThreshold: false };
    };

    const onTouchMove = (e: TouchEvent) => {
      const s = touchRef.current;
      if (!s) return;
      const t = e.touches[0];
      const dx = t.clientX - s.startX;
      const dy = t.clientY - s.startY;

      if (!s.locked) {
        if (Math.abs(dx) < ACTIVATION && Math.abs(dy) < ACTIVATION) return;
        // Vertical scroll wins — abandon
        if (Math.abs(dy) > Math.abs(dx)) { touchRef.current = null; return; }
        // Wrong direction
        if (dx * direction < 0) { touchRef.current = null; return; }
        s.locked = true;
        setIsDragging(true);
      }

      e.preventDefault(); // we own this gesture now → block vertical scroll
      const magnitude = Math.min(Math.abs(dx), MAX_DRAG);
      setDragX(magnitude * direction);

      // Haptic tick at threshold crossing
      if (magnitude >= SWIPE_TRIGGER && !s.crossedThreshold) {
        s.crossedThreshold = true;
        if ('vibrate' in navigator) navigator.vibrate(12);
      } else if (magnitude < SWIPE_TRIGGER && s.crossedThreshold) {
        s.crossedThreshold = false;
      }
    };

    const onTouchEnd = () => {
      const s = touchRef.current;
      if (s?.locked && s.crossedThreshold) onReply(message);
      touchRef.current = null;
      setIsDragging(false);
      setDragX(0);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isMe, isSending, isFailed, onReply, message]);

  const dragProgress = Math.min(Math.abs(dragX) / SWIPE_TRIGGER, 1);

  return (
    <div ref={rowRef} className={`relative ${isFirstInSequence ? 'mt-4' : 'mt-2'}`}>
      {/* Reply indicator — fades / scales in as user drags */}
      {dragProgress > 0 && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 ${isMe ? 'right-2' : 'left-2'} pointer-events-none`}
          style={{ opacity: dragProgress }}
        >
          <div
            className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center"
            style={{ transform: `scale(${0.6 + dragProgress * 0.4})` }}
          >
            <Reply className="h-[18px] w-[18px] text-primary" />
          </div>
        </div>
      )}

      <div
        className={`flex items-end gap-1.5 group ${isMe ? "justify-end" : "justify-start"}`}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
      {/* Sender avatar */}
      {!isMe && isFirstInSequence && (
        <Avatar className="h-7 w-7 mb-0.5 flex-shrink-0 ring-1 ring-border/30">
          <AvatarImage src={userProfile?.profile_picture || ""} className="object-cover" />
          <AvatarFallback className="text-[10px] bg-gradient-primary text-primary-foreground font-bold">
            {userProfile?.name?.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
      )}
      {!isMe && !isFirstInSequence && <div className="w-7 flex-shrink-0" />}

      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%] sm:max-w-[70%] lg:max-w-[65%] relative`}>
        {/* Hover action bar — hidden on mobile (use long-press instead), shown on desktop hover */}
        {!isFailed && !isSending && (
          <div className={`absolute ${isMe ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1'} top-1/2 -translate-y-1/2 hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity z-20 items-center gap-0.5`}>
            <button
              onClick={() => setShowReactionPicker(!showReactionPicker)}
              className="h-7 w-7 rounded-full bg-background/90 border border-border/50 shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
              title="React"
            >
              <SmilePlus className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button
              onClick={() => onReply(message)}
              className="h-7 w-7 rounded-full bg-background/90 border border-border/50 shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
              title="Reply"
            >
              <Reply className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {message.message && (
              <button
                onClick={copyMessage}
                className="h-7 w-7 rounded-full bg-background/90 border border-border/50 shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
                title="Copy"
              >
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        )}

        {/* Reaction picker popup */}
        {showReactionPicker && (
          <div className={`absolute ${isMe ? 'right-0' : 'left-0'} -top-12 z-30`}>
            <ReactionPicker
              onSelect={(emoji) => onReact(message.id, emoji)}
              onClose={() => setShowReactionPicker(false)}
            />
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`relative px-3 py-2 ${
            isMe
              ? `chat-bubble-me ${isFirstInSequence ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl'} ${!isLastInSequence ? 'rounded-br-sm' : ''}`
              : `chat-bubble-other ${isFirstInSequence ? 'rounded-2xl rounded-bl-sm' : 'rounded-2xl'} ${!isLastInSequence ? 'rounded-bl-sm' : ''}`
          } ${isFailed ? 'opacity-50 ring-1 ring-red-400/50' : ''} ${isSending ? 'opacity-70' : ''}`}
        >
          {/* Reply preview */}
          {replyTo && (
            <div className={`mb-1.5 px-2.5 py-1.5 rounded-lg border-l-2 ${isMe ? 'bg-white/10 border-white/40' : 'bg-primary/5 border-primary/40'} cursor-pointer`}>
              <p className={`text-[10px] font-bold ${isMe ? 'text-white/70' : 'text-primary/70'}`}>
                {replyTo.senderName}
              </p>
              <p className={`text-[11px] truncate ${isMe ? 'text-white/50' : 'text-muted-foreground'}`}>
                {replyTo.imageUrl ? '📷 Photo' : replyTo.text || ''}
              </p>
            </div>
          )}

          {/* Image */}
          {message.image_url && (
            <div
              className="relative overflow-hidden rounded-lg mb-1.5 cursor-pointer group/img"
              onClick={() => onImageClick(message.image_url!)}
            >
              {!imageLoaded && (
                <div className="w-full h-48 bg-black/10 animate-pulse rounded-lg" />
              )}
              <img
                src={message.image_url}
                alt="Attachment"
                loading="lazy"
                decoding="async"
                className={`w-full max-h-72 object-cover rounded-lg group-hover/img:brightness-90 transition-all ${imageLoaded ? '' : 'h-0 overflow-hidden'}`}
                onLoad={() => setImageLoaded(true)}
              />
            </div>
          )}

          {/* Embedded post — when this message was sent in the context of a
              post (Buy / I Can Help on a feed card), the post lives inside
              the bubble itself so the receiver knows what we're talking about. */}
          {message.post && (
            <a
              href={`/post/${message.post.id}`}
              onClick={(e) => { e.preventDefault(); window.location.href = `/post/${message.post!.id}`; }}
              className={`flex items-stretch gap-2.5 mb-1.5 rounded-lg overflow-hidden transition-colors ${
                isMe
                  ? 'bg-white/15 hover:bg-white/20'
                  : 'bg-primary/5 hover:bg-primary/10 border border-primary/15'
              }`}
            >
              <div className={`h-14 w-14 flex-shrink-0 ${isMe ? 'bg-white/10' : 'bg-muted/40'} flex items-center justify-center`}>
                {message.post.image_url ? (
                  <img src={message.post.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isMe ? 'text-white/60' : 'text-primary/60'}`}>
                    Post
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0 py-2 pr-2">
                <p className={`text-[11px] font-bold uppercase tracking-wider mb-0.5 ${isMe ? 'text-white/70' : 'text-primary/70'}`}>
                  About this post
                </p>
                <p className={`text-xs font-bold leading-tight truncate ${isMe ? 'text-white' : 'text-foreground'}`}>
                  {message.post.title}
                </p>
                {message.post.optional_price != null && (
                  <p className={`text-[11px] font-semibold leading-tight mt-0.5 ${isMe ? 'text-white/85' : 'text-primary'}`}>
                    ₦{Number(message.post.optional_price).toLocaleString()}
                  </p>
                )}
              </div>
            </a>
          )}

          {/* Text */}
          {message.message && renderMessageContent(message.message)}
        </div>

        {/* Time + status — sits OUTSIDE the bubble (matches mockup) */}
        {isLastInSequence && (
          <div className={`flex items-center gap-1 mt-1 px-1 ${isMe ? 'flex-row-reverse text-muted-foreground/70' : 'text-muted-foreground/70'}`}>
            <time className="text-[10px] font-medium tabular-nums tracking-tight">
              {formatMessageTime(message.created_at)}
            </time>
            {isMe && getStatusIcon()}
          </div>
        )}

        {/* Reactions display */}
        {hasReactions && (
          <div className={`flex flex-wrap gap-1 mt-0.5 -mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
            {message.reactions!.map((reaction) => {
              const iReacted = reaction.userIds.includes(currentUserId);
              return (
                <button
                  key={reaction.emoji}
                  onClick={() => onReact(message.id, reaction.emoji)}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-all hover:scale-110 active:scale-95 ${
                    iReacted
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-muted/60 border-border/40 text-foreground/70 hover:bg-muted'
                  }`}
                >
                  <span className="text-sm leading-none">{reaction.emoji}</span>
                  {reaction.count > 1 && <span className="text-[10px] font-bold">{reaction.count}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Failed retry */}
        {isFailed && (
          <button
            onClick={onRetry}
            className="text-[11px] text-destructive hover:text-destructive/80 font-medium flex items-center gap-1 mt-1 px-1 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Tap to retry
          </button>
        )}
      </div>
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';
