import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversationListSkeleton } from "@/components/ui/skeleton-loaders";
import { Conversation } from "./types";
import { formatRelativeTime } from "./utils";

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversation: string | null;
  onSelectConversation: (userId: string, roomId: string) => void;
  isLoading: boolean;
  onlineUsers: Set<string>;
  showOnMobile: boolean;
}

export const ConversationList = ({
  conversations,
  selectedConversation,
  onSelectConversation,
  isLoading,
  onlineUsers,
}: ConversationListProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header — bold "Messages" + compose icon (matches mockup) */}
      <div
        className="px-5 pt-3 pb-3 flex items-center justify-between flex-shrink-0 md:pt-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <h1 className="text-[26px] font-bold tracking-tight">Messages</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/user-search')}
          className="h-10 w-10 rounded-full hover:bg-muted text-foreground/80"
          aria-label="Start new conversation"
        >
          <SquarePen className="h-[20px] w-[20px]" />
        </Button>
      </div>

      {/* Conversation rows */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="px-2 py-1">
            <ConversationListSkeleton />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground py-20 px-4 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <MessageSquare className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="font-semibold text-foreground/80 mb-1">No messages yet</p>
            <p className="text-sm">Tap the compose icon to start a chat</p>
          </div>
        ) : (
          <ul className="px-2 divide-y divide-border/40">
            {conversations.map((conv) => {
              const isSelected = selectedConversation === conv.userId;
              const isUserOnline = onlineUsers.has(conv.userId);
              const hasUnread = conv.unreadCount > 0;

              return (
                <li key={conv.userId}>
                  <button
                    onClick={() => onSelectConversation(conv.userId, conv.roomId)}
                    className={`w-full flex items-center gap-3 px-3 py-3.5 cursor-pointer transition-colors text-left ${
                      isSelected ? 'bg-primary/8' : 'hover:bg-muted/40 active:bg-muted/60'
                    }`}
                  >
                    {/* Avatar with online dot */}
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={conv.profilePicture || ""} alt={conv.userName} className="object-cover" />
                        <AvatarFallback className="text-sm font-semibold bg-gradient-primary text-primary-foreground">
                          {conv.userName?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      {isUserOnline && (
                        <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
                      )}
                    </div>

                    {/* Name + last message */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={`truncate text-[15px] ${hasUnread ? 'font-bold text-foreground' : 'font-semibold text-foreground'}`}>
                          {conv.userName}
                        </span>
                        <time className={`text-[11px] whitespace-nowrap flex-shrink-0 ${hasUnread ? 'text-primary font-semibold' : 'text-muted-foreground/70'}`}>
                          {formatRelativeTime(conv.timestamp)}
                        </time>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-[13px] truncate ${hasUnread ? 'text-foreground/85 font-medium' : 'text-muted-foreground'}`}>
                          {conv.lastMessage}
                        </p>
                        {hasUnread && (
                          <span className="bg-primary text-primary-foreground text-[10px] font-bold h-[18px] min-w-[18px] px-1 rounded-full flex items-center justify-center flex-shrink-0">
                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
};
