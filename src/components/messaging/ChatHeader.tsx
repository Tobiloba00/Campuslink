import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { UserProfile } from "./types";
import { memo } from "react";

interface ChatHeaderProps {
  userProfile: UserProfile | null;
  isOnline: boolean;
  onBack: () => void;
}

export const ChatHeader = memo(({ userProfile, isOnline, onBack }: ChatHeaderProps) => {
  return (
    <div className="p-3 sm:p-4 border-b bg-card/60 backdrop-blur-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-500 z-10 sticky top-0">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden hover:bg-secondary/80 rounded-full h-9 w-9 transition-transform active:scale-95"
        onClick={onBack}
        aria-label="Back to conversations"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      
      <div className="relative">
        <Avatar className="h-11 w-11 ring-2 ring-background shadow-md transition-transform hover:scale-105">
          <AvatarImage src={userProfile?.profile_picture || ""} alt={userProfile?.name} className="object-cover" />
          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 font-semibold text-primary">
            {userProfile?.name?.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
        {isOnline && (
          <div
            className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-success border-2 border-background shadow-md animate-in zoom-in duration-300"
            aria-label="Online"
          >
            <div className="absolute inset-0 rounded-full bg-success animate-ping opacity-20" />
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-base sm:text-lg truncate tracking-tight">
          {userProfile?.name || "User"}
        </h2>
        {isOnline ? (
          <p className="text-xs text-success font-medium animate-in fade-in" aria-live="polite">
            Active now
          </p>
        ) : userProfile?.course ? (
          <p className="text-xs text-muted-foreground truncate opacity-80 mt-0.5">
            {userProfile.course}
          </p>
        ) : userProfile?.rating && userProfile.rating > 0 ? (
          <p className="text-xs text-muted-foreground flex items-center gap-1 opacity-80 mt-0.5">
            <span className="text-amber-500">⭐</span> {userProfile.rating.toFixed(1)} rating
          </p>
        ) : null}
      </div>
    </div>
  );
});

ChatHeader.displayName = 'ChatHeader';
