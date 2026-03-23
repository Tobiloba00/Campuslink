import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, CheckCheck, Loader2, Copy, RotateCcw, SmilePlus, Reply } from "lucide-react";
import { Message, UserProfile, ReplyContext } from './types';
import { formatMessageTime, detectLinks } from "./utils";
import { useState, memo } from 'react';
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
        return <Loader2 className="h-3 w-3 animate-spin opacity-40" />;
      case 'failed':
        return <span className="text-[9px] text-red-300 font-bold">!</span>;
      default:
        return message.read_at
          ? <CheckCheck className="h-3.5 w-3.5 text-sky-300" />
          : <Check className="h-3.5 w-3.5 opacity-40" />;
    }
  };

  // Reply preview inside bubble
  const replyTo = message.replyTo;

  return (
    <div
      className={`flex items-end gap-1.5 group relative ${isMe ? "justify-end" : "justify-start"} ${isFirstInSequence ? 'mt-4' : 'mt-2'}`}
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

          {/* Text */}
          {message.message && renderMessageContent(message.message)}

          {/* Time + status */}
          <div className={`flex items-center gap-1 mt-0.5 justify-end ${isMe ? 'text-white/50' : 'text-muted-foreground/50'}`}>
            <time className="text-[9px] font-medium tabular-nums tracking-tight">
              {formatMessageTime(message.created_at)}
            </time>
            {getStatusIcon()}
          </div>
        </div>

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
  );
});

MessageBubble.displayName = 'MessageBubble';
