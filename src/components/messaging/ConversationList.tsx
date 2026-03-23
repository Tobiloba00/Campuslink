import { useState, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  showOnMobile
}: ConversationListProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    return conversations.filter(c =>
      c.userName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conversations, searchQuery]);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 pb-3 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Messages
            {totalUnread > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-bold h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </h2>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-muted/50 border-border/40 focus:bg-background transition-colors rounded-xl text-sm"
          />
        </div>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <ConversationListSkeleton />
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-muted-foreground py-16 px-4 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <MessageSquare className="h-7 w-7 text-muted-foreground/30" />
              </div>
              {searchQuery ? (
                <>
                  <p className="font-semibold text-foreground/80 mb-1">No results</p>
                  <p className="text-sm">No conversations matching "{searchQuery}"</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-foreground/80 mb-1">No messages yet</p>
                  <p className="text-sm">Start a conversation from the feed or people page</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredConversations.map((conv) => {
                const isSelected = selectedConversation === conv.userId;
                const isUserOnline = onlineUsers.has(conv.userId);
                const hasUnread = conv.unreadCount > 0;

                return (
                  <button
                    key={conv.userId}
                    onClick={() => onSelectConversation(conv.userId, conv.roomId)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 text-left ${
                      isSelected
                        ? "bg-primary/10 border border-primary/15"
                        : "hover:bg-muted/60 active:scale-[0.98] border border-transparent"
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <Avatar className={`h-12 w-12 ring-2 ${isSelected ? 'ring-primary/20' : 'ring-transparent'} transition-all`}>
                        <AvatarImage src={conv.profilePicture || ""} alt={conv.userName} className="object-cover" />
                        <AvatarFallback className="text-sm font-semibold bg-gradient-primary text-primary-foreground">
                          {conv.userName?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      {isUserOnline && (
                        <div className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-background" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`font-semibold text-sm truncate ${isSelected ? 'text-primary' : ''} ${hasUnread ? 'text-foreground' : ''}`}>
                          {conv.userName}
                        </span>
                        <time className={`text-[10px] whitespace-nowrap ml-2 ${hasUnread ? 'text-primary font-semibold' : 'text-muted-foreground/60'}`}>
                          {formatRelativeTime(conv.timestamp)}
                        </time>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs truncate ${hasUnread ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                          {conv.lastMessage}
                        </p>
                        {hasUnread && (
                          <span className="bg-primary text-primary-foreground text-[10px] font-bold h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center flex-shrink-0">
                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
