import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Star } from "lucide-react";
import { UserProfile } from "./types";
import { memo } from "react";

interface ChatHeaderProps {
  userProfile: UserProfile | null;
  isOnline: boolean;
  onBack: () => void;
}

export const ChatHeader = memo(({ userProfile, isOnline, onBack }: ChatHeaderProps) => {
  return (
    <div className="px-3 sm:px-4 py-3 border-b border-border/50 bg-background/80 backdrop-blur-xl flex items-center gap-3 z-10">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden rounded-full h-9 w-9 hover:bg-muted transition-all active:scale-95 flex-shrink-0"
        onClick={onBack}
        aria-label="Back to conversations"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>

      <div className="relative flex-shrink-0">
        <Avatar className="h-10 w-10 ring-2 ring-border/50">
          <AvatarImage src={userProfile?.profile_picture || ""} alt={userProfile?.name} className="object-cover" />
          <AvatarFallback className="bg-gradient-primary text-primary-foreground font-semibold text-sm">
            {userProfile?.name?.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
        {isOnline && (
          <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-[15px] truncate leading-tight">
          {userProfile?.name || "User"}
        </h2>
        <div className="flex items-center gap-2 mt-0.5">
          {isOnline ? (
            <span className="text-xs text-emerald-500 font-medium">Online</span>
          ) : userProfile?.course ? (
            <span className="text-xs text-muted-foreground truncate">{userProfile.course}</span>
          ) : null}
          {userProfile?.rating && userProfile.rating > 0 && (
            <>
              {(isOnline || userProfile?.course) && <span className="text-muted-foreground/30 text-xs">·</span>}
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {userProfile.rating.toFixed(1)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

ChatHeader.displayName = 'ChatHeader';
