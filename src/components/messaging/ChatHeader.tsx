import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MoreVertical, UserCircle, BellOff, Trash2 } from "lucide-react";
import { UserProfile } from "./types";
import { memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface ChatHeaderProps {
  userProfile: UserProfile | null;
  isOnline: boolean;
  onBack: () => void;
}

export const ChatHeader = memo(({ userProfile, isOnline, onBack }: ChatHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className="px-3 sm:px-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-3 md:pt-3 border-b border-border/40 bg-background/80 backdrop-blur-xl flex items-center gap-3 z-10 flex-shrink-0">
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
        <Avatar className="h-10 w-10">
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
        <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
          {isOnline ? (
            <span className="text-emerald-500 font-medium">Online</span>
          ) : userProfile?.course ? (
            userProfile.course
          ) : null}
        </p>
      </div>

      {/* Three-dot menu (no call button per spec) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-9 w-9 hover:bg-muted transition-all flex-shrink-0"
            aria-label="More options"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-xl">
          <DropdownMenuItem
            className="rounded-lg text-sm"
            onClick={() => userProfile && navigate(`/rate-user/${userProfile.id}`)}
          >
            <UserCircle className="mr-2 h-4 w-4" /> View profile
          </DropdownMenuItem>
          <DropdownMenuItem
            className="rounded-lg text-sm"
            onClick={() => toast.info("Mute coming soon")}
          >
            <BellOff className="mr-2 h-4 w-4" /> Mute notifications
          </DropdownMenuItem>
          <DropdownMenuItem
            className="rounded-lg text-sm text-destructive focus:text-destructive"
            onClick={() => toast.info("Delete chat coming soon")}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete chat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

ChatHeader.displayName = 'ChatHeader';
