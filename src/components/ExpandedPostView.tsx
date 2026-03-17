import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { format } from "date-fns";
import { 
  Heart, 
  MessageCircle, 
  Repeat2, 
  Bookmark, 
  Share2, 
  MoreHorizontal,
  Star,
  Edit,
  Trash
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface ExpandedPostViewProps {
  post: any;
  isOwner: boolean;
  onReply: () => void;
  onLike: () => void;
  onRepost: () => void;
  onBookmark: () => void;
  onShare: () => void;
}

export const ExpandedPostView = ({ 
  post, 
  isOwner, 
  onReply, 
  onLike, 
  onRepost, 
  onBookmark, 
  onShare 
}: ExpandedPostViewProps) => {
  if (!post) return null;

  return (
    <Card className="border-none shadow-none bg-transparent mb-4">
      <CardHeader className="px-0 pt-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12 ring-2 ring-background shadow-sm">
              <AvatarImage src={post.profiles.profile_picture || ""} alt={post.profiles.name} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                {post.profiles.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-bold text-[17px] text-foreground leading-tight hover:underline cursor-pointer">
                {post.profiles.name}
              </span>
              <span className="text-muted-foreground text-[15px] leading-tight">
                @{post.profiles.name.toLowerCase().replace(/\s+/g, '')}
              </span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {isOwner && (
                <>
                  <DropdownMenuItem onClick={() => toast.info("Edit post coming soon!")}>
                    <Edit className="mr-2 h-4 w-4" />
                    <span>Edit post</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive focus:text-destructive">
                    <Trash className="mr-2 h-4 w-4" />
                    <span>Delete post</span>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={() => toast.info("Post reported")}>
                <MessageCircle className="mr-2 h-4 w-4" />
                <span>Report post</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onShare}>
                <Share2 className="mr-2 h-4 w-4" />
                <span>Copy link to post</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="px-0 space-y-4">
        <div className="space-y-3">
          <h1 className="text-[22px] md:text-[23px] font-bold text-foreground leading-tight">
            {post.title}
          </h1>
          <p className="text-[18px] md:text-[19px] leading-normal text-foreground/90 whitespace-pre-wrap">
            {post.description}
          </p>
        </div>

        {post.image_url && (
          <div className="w-full overflow-hidden rounded-2xl border border-border/20 shadow-sm mt-4">
            <img
              src={post.image_url}
              alt={post.title}
              className="w-full h-auto object-cover max-h-[1200px]"
            />
          </div>
        )}

        <div className="flex items-center gap-4 py-4 text-[15px] text-muted-foreground border-b border-border/10">
          <span>{format(new Date(post.created_at), "h:mm a · MMM d, yyyy")}</span>
          <span className="flex items-center gap-1 font-medium text-foreground">
            <span className="text-muted-foreground font-normal">Translate post</span>
          </span>
        </div>

        <div className="flex items-center gap-6 py-4 border-b border-border/10 text-[15px]">
          {post.view_count > 0 && (
            <div className="flex items-center gap-1.5 hover:underline cursor-pointer">
              <span className="font-bold text-foreground">{post.view_count}</span>
              <span className="text-muted-foreground">Views</span>
            </div>
          )}
          {post.likes_count > 0 && (
            <div className="flex items-center gap-1.5 hover:underline cursor-pointer">
              <span className="font-bold text-foreground">{post.likes_count}</span>
              <span className="text-muted-foreground">Likes</span>
            </div>
          )}
          {post.reposts_count > 0 && (
            <div className="flex items-center gap-1.5 hover:underline cursor-pointer">
              <span className="font-bold text-foreground">{post.reposts_count}</span>
              <span className="text-muted-foreground">Reposts</span>
            </div>
          )}
          {post.bookmarks_count > 0 && (
            <div className="flex items-center gap-1.5 hover:underline cursor-pointer">
              <span className="font-bold text-foreground">{post.bookmarks_count}</span>
              <span className="text-muted-foreground">Bookmarks</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-1 py-1 text-muted-foreground">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onReply}
            className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors h-11 w-11"
          >
            <MessageCircle className="h-5.5 w-5.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-green-500/10 hover:text-green-500 transition-colors h-11 w-11"
              >
                <Repeat2 className="h-5.5 w-5.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              <DropdownMenuItem onClick={onRepost}>
                <Repeat2 className="mr-2 h-4 w-4" />
                <span>Repost</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info("Quote feature coming soon!")}>
                <Edit className="mr-2 h-4 w-4" />
                <span>Quote</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onLike}
            className="rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors h-11 w-11"
          >
            <Heart className="h-5.5 w-5.5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBookmark}
            className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors h-11 w-11"
          >
            <Bookmark className="h-5.5 w-5.5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onShare}
            className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors h-11 w-11"
          >
            <Share2 className="h-5.5 w-5.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
