import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, CheckCheck, Loader2, Copy, Trash2, Reply } from "lucide-react";
import { Message, UserProfile } from './types';
import { useState, memo } from 'react';
import { detectLinks } from "./utils";
import { toast } from "sonner";

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  isFirstInSequence: boolean;
  isLastInSequence: boolean;
  userProfile: UserProfile | null;
  currentUserId: string;
}

export const MessageBubble = memo(({
  message,
  isMe,
  isFirstInSequence,
  userProfile
}: MessageBubbleProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showActions, setShowActions] = useState(false);

  // Link detection rendering
  const renderMessageContent = (text: string) => {
    if (!text) return null;
    const links = detectLinks(text);
    if (links.length === 0) return <p className="text-[14px] sm:text-[15px] leading-relaxed break-words px-0.5">{text}</p>;

    let parts = text.split(/(https?:\/\/[^\s]+)/g);
    
    return (
      <p className="text-[14px] sm:text-[15px] leading-relaxed break-words px-0.5">
        {parts.map((part, i) => {
          if (part.match(/https?:\/\/[^\s]+/)) {
            return (
              <a 
                key={i} 
                href={part} 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline underline-offset-2 opacity-90 hover:opacity-100 transition-opacity font-medium break-all"
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

  const copyToClipboard = () => {
    if (message.message) {
      navigator.clipboard.writeText(message.message);
      toast.success("Copied to clipboard");
    }
    setShowActions(false);
  };

  const getStatusIcon = () => {
    if (!isMe) return null;
    
    switch (message.status) {
      case 'sending':
        return <Loader2 className="h-3 w-3 animate-spin text-primary-foreground/50" />;
      case 'failed':
        return <span className="text-[9px] text-destructive">!</span>;
      default:
        return message.read_at ? (
          <CheckCheck className="h-3.5 w-3.5 text-blue-400 animate-in zoom-in duration-300" />
        ) : (
          <Check className="h-3.5 w-3.5 text-primary-foreground/50 animate-in zoom-in" />
        );
    }
  };

  return (
    <div
      className={`flex gap-2 group relative animate-in fade-in slide-in-from-bottom-2 duration-300 ${isMe ? "justify-end" : "justify-start"} ${isFirstInSequence ? 'mt-3' : 'mt-0.5'}`}
      role="article"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onPointerDown={() => setShowActions(true)}
    >
      {!isMe && isFirstInSequence && (
        <Avatar className="h-8 w-8 ring-2 ring-background shadow-sm absolute -left-10 hidden sm:flex">
          <AvatarImage src={userProfile?.profile_picture || ""} alt={userProfile?.name} className="object-cover" />
          <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
            {userProfile?.name?.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
      )}

      {/* Floating Action Menu for Desktop (hover) */}
      {showActions && isMe && (
        <div className="absolute top-1/2 -translate-y-1/2 -left-12 flex items-center gap-1 opacity-100 transition-opacity bg-card/80 backdrop-blur-sm p-1 rounded-xl shadow-sm border border-border/40 animate-in fade-in zoom-in duration-200">
          <button onClick={copyToClipboard} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Copy text">
            <Copy className="h-3 w-3" />
          </button>
        </div>
      )}
      
      {showActions && !isMe && (
        <div className="absolute top-1/2 -translate-y-1/2 -right-12 flex items-center gap-1 opacity-100 transition-opacity bg-card/80 backdrop-blur-sm p-1 rounded-xl shadow-sm border border-border/40 animate-in fade-in zoom-in duration-200">
           <button onClick={copyToClipboard} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Copy text">
            <Copy className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className={`flex flex-col max-w-[85%] sm:max-w-[70%] lg:max-w-[60%] relative`}>
        <div
          className={`p-2.5 sm:p-3 sm:px-4 rounded-2xl transition-all duration-300 shadow-sm relative ${
            isMe
              ? "bg-primary text-primary-foreground rounded-tr-sm hover:shadow-md"
              : "bg-card border border-border/40 rounded-tl-sm hover:border-border/80"
          } ${!isFirstInSequence ? 'rounded-t-2xl' : ''} ${
            message.status === 'failed' ? 'opacity-70 border-destructive/50 ring-1 ring-destructive' : ''
          }`}
        >
          {isFirstInSequence && (
            <div className={`absolute top-0 w-3 h-3 ${
              isMe
                ? "right-[-6px] bg-primary clip-path-tail-right"
                : "left-[-6px] bg-card border-l border-t border-border/40 clip-path-tail-left"
            }`} />
          )}

          {message.image_url && (
            <div 
              className="relative group/img overflow-hidden rounded-xl mb-1.5 transition-all shadow-sm ring-1 ring-black/5 cursor-zoom-in"
              onClick={() => window.open(message.image_url!, '_blank')}
            >
              {!imageLoaded && (
                <div className="absolute inset-0 bg-black/10 animate-pulse" />
              )}
              <img
                src={message.image_url}
                alt="Attachment"
                loading="lazy"
                decoding="async"
                className={`w-full max-h-80 object-cover hover:scale-[1.02] transition-transform duration-700 ease-out ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setImageLoaded(true)}
              />
            </div>
          )}

          {renderMessageContent(message.message || '')}

          <div className={`flex items-center gap-1.5 mt-1 justify-end opacity-70`}>
            <time
              className="text-[9.5px] font-semibold uppercase tracking-tighter tabular-nums"
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
          <p className="text-[10px] text-destructive mt-1 px-1 flex items-center gap-1 animate-in slide-in-from-top-1">
            <span className="h-1 w-1 rounded-full bg-destructive animate-pulse" />
            Failed to send. Tap retry in input.
          </p>
        )}
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';
