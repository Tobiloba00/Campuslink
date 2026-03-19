import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, CheckCheck, Loader2 } from "lucide-react";
import { Message, UserProfile } from './types';
import { useState } from 'react';

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  isFirstInSequence: boolean;
  isLastInSequence: boolean;
  userProfile: UserProfile | null;
  currentUserId: string;
}

export const MessageBubble = ({
  message,
  isMe,
  isFirstInSequence,
  userProfile,
  currentUserId
}: MessageBubbleProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  const getStatusIcon = () => {
    if (!isMe) return null;

    switch (message.status) {
      case 'sending':
        return <Loader2 className="h-3 w-3 animate-spin text-primary-foreground/50" />;
      case 'failed':
        return <span className="text-[9px] text-destructive">!</span>;
      case 'delivered':
      case 'sent':
        return message.read_at ? (
          <CheckCheck className="h-3 w-3 text-blue-400" />
        ) : (
          <Check className="h-3 w-3 text-primary-foreground/50" />
        );
      default:
        return message.read_at ? (
          <CheckCheck className="h-3 w-3 text-blue-400" />
        ) : (
          <Check className="h-3 w-3 text-primary-foreground/50" />
        );
    }
  };

  return (
    <div
      className={`flex gap-2 group relative ${isMe ? "justify-end" : "justify-start"} ${isFirstInSequence ? 'mt-4' : 'mt-1'}`}
      role="article"
      aria-label={`Message from ${isMe ? 'you' : userProfile?.name || 'user'}`}
    >
      {!isMe && isFirstInSequence && (
        <Avatar className="h-8 w-8 ring-2 ring-background shadow-sm absolute -left-10 hidden sm:flex">
          <AvatarImage src={userProfile?.profile_picture || ""} alt={userProfile?.name} />
          <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-primary/10">
            {userProfile?.name?.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={`flex flex-col max-w-[85%] sm:max-w-[70%] lg:max-w-[60%] relative`}>
        <div
          className={`p-2.5 sm:p-3 rounded-2xl transition-all duration-200 shadow-sm relative ${
            isMe
              ? "bg-primary text-primary-foreground rounded-tr-none"
              : "bg-card border border-border/40 rounded-tl-none"
          } ${!isFirstInSequence ? 'rounded-t-2xl' : ''} ${
            message.status === 'failed' ? 'opacity-60 border-destructive' : ''
          }`}
        >
          {/* Bubble Tail */}
          {isFirstInSequence && (
            <div className={`absolute top-0 w-3 h-3 ${
              isMe
                ? "right-[-6px] bg-primary clip-path-tail-right"
                : "left-[-6px] bg-card border-l border-t border-border/40 clip-path-tail-left"
            }`} />
          )}

          {message.image_url && (
            <div className="relative group/img overflow-hidden rounded-xl mb-1.5 transition-all">
              {!imageLoaded && (
                <div className="absolute inset-0 bg-muted animate-pulse" />
              )}
              <img
                src={message.image_url}
                alt="Message attachment"
                loading="lazy"
                decoding="async"
                className={`w-full max-h-80 object-cover cursor-pointer hover:scale-[1.02] transition-transform duration-500 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onClick={() => window.open(message.image_url!, '_blank')}
                onLoad={() => setImageLoaded(true)}
              />
            </div>
          )}

          {message.message && (
            <p className="text-[14px] sm:text-[15px] leading-relaxed break-words px-0.5">
              {message.message}
            </p>
          )}

          <div className={`flex items-center gap-1.5 mt-1 justify-end opacity-70`}>
            <time
              className="text-[9px] sm:text-[10px] font-medium uppercase tracking-tighter"
              dateTime={message.created_at}
            >
              {new Date(message.created_at).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })}
            </time>
            {getStatusIcon()}
          </div>
        </div>

        {message.status === 'failed' && (
          <button
            className="text-[10px] text-destructive mt-1 hover:underline"
            onClick={() => {
              // TODO: Implement retry logic
              console.log('Retry sending message:', message.id);
            }}
            aria-label="Retry sending message"
          >
            Tap to retry
          </button>
        )}
      </div>
    </div>
  );
};
