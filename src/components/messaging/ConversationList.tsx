import { useState, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ConversationListSkeleton } from "@/components/ui/skeleton-loaders";
import { Conversation } from "./types";
import { formatRelativeTime } from "./utils";
import { Card } from "@/components/ui/card";

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

  return (
    <Card className={`glass-panel p-3 sm:p-4 flex flex-col h-full overflow-hidden border-white/20 shadow-xl ${showOnMobile ? 'block' : 'hidden md:block'}`}>
      <div className="flex flex-col gap-4 mb-4">
        <h2 className="font-bold text-lg flex items-center gap-2 px-1">
          <MessageSquare className="h-5 w-5 text-primary" />
          Messages
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search conversations..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card/50 border-border/40 focus:bg-card transition-colors rounded-xl"
          />
        </div>
      </div>

      <ScrollArea className="h-full pr-2 -mr-2">
        {isLoading ? (
          <ConversationListSkeleton />
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground py-12 px-4 text-center animate-in fade-in duration-500">
            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 opacity-20" />
            </div>
            {searchQuery ? (
              <p>No matches found for "{searchQuery}"</p>
            ) : (
              <>
                <p className="font-medium text-foreground/80 mb-1">No messages yet</p>
                <p className="text-sm">Start a conversation with someone!</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredConversations.map((conv, index) => {
              const isSelected = selectedConversation === conv.userId;
              const isOnline = onlineUsers.has(conv.userId);
              
              return (
                <div
                  key={conv.userId}
                  onClick={() => onSelectConversation(conv.userId, conv.roomId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectConversation(conv.userId, conv.roomId);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Conversation with ${conv.userName}`}
                  className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 animate-in fade-in slide-in-from-bottom-2 ${
                    isSelected
                      ? "bg-primary/10 border border-primary/20 shadow-sm"
                      : "hover:bg-secondary/60 active:scale-[0.98] border border-transparent"
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar className={`h-12 w-12 ring-2 shadow-sm transition-transform duration-300 ${isSelected ? 'ring-primary/30 scale-105' : 'ring-background group-hover:scale-105'}`}>
                      <AvatarImage src={conv.profilePicture || ""} alt={conv.userName} className="object-cover" />
                      <AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                        {conv.userName?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    {isOnline && (
                      <div className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-success border-2 border-background shadow-md">
                        <div className="absolute inset-0 rounded-full bg-success animate-ping opacity-20" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`font-semibold text-sm truncate tracking-tight transition-colors ${isSelected ? 'text-primary' : 'group-hover:text-primary'}`}>
                        {conv.userName}
                      </span>
                      <time
                        className={`text-[10px] whitespace-nowrap ml-2 font-medium ${isSelected ? 'text-primary/70' : 'text-muted-foreground/70'}`}
                      >
                        {formatRelativeTime(conv.timestamp)}
                      </time>
                    </div>
                    
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate transition-colors ${
                        conv.unreadCount && conv.unreadCount > 0 
                          ? 'font-semibold text-foreground' 
                          : 'text-muted-foreground'
                      }`}>
                        {conv.lastMessage}
                      </p>
                      
                      {conv.unreadCount && conv.unreadCount > 0 ? (
                        <div className="bg-primary text-primary-foreground text-[10px] font-bold h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center shadow-sm animate-in zoom-in">
                          {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
};
