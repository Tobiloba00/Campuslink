import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Heart, Share2, MoreHorizontal, Copy, Trash, Edit,
  BookOpen, GraduationCap, ShoppingBag, Sparkles,
  MessageSquare, Bookmark
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface PostCardProps {
  post: {
    id: string;
    title: string;
    description: string;
    category: string;
    optional_price: number | null;
    ai_summary: string | null;
    image_url: string | null;
    created_at: string;
    user_id: string;
    tags: string[] | null;
    campus_highlight: string | null;
    comment_count?: number;
    profiles: {
      name: string;
      rating: number;
      profile_picture: string | null;
    };
  };
  isLiked: boolean;
  likeCount: number;
  isOwner: boolean;
  onLike: (postId: string, e: React.MouseEvent) => void;
  onDelete: (postId: string, e: React.MouseEvent) => void;
  onShare: (postId: string, title: string, description: string, e: React.MouseEvent) => void;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof BookOpen; color: string; bg: string; label: string; action: string; actionIcon: typeof MessageSquare }> = {
  'Academic Help': { icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'ACADEMIC', action: 'I Can Help', actionIcon: MessageSquare },
  'Tutoring': { icon: GraduationCap, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'TUTORING', action: 'Book Session', actionIcon: GraduationCap },
  'Buy & Sell': { icon: ShoppingBag, color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'MARKETPLACE', action: 'Make Offer', actionIcon: ShoppingBag },
};

const formatTimestamp = (timestamp: string) => {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const PostCard = memo(({ post, isLiked, likeCount, isOwner, onLike, onDelete, onShare }: PostCardProps) => {
  const navigate = useNavigate();
  const config = CATEGORY_CONFIG[post.category] || CATEGORY_CONFIG['Academic Help'];
  const CategoryIcon = config.icon;
  const ActionIcon = config.actionIcon;

  const copyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
    toast.success("Link copied!");
  };

  return (
    <article
      className="bg-card border border-border/40 dark:border-border/20 rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 hover:border-border/60 hover:shadow-lg hover:shadow-black/[0.03] dark:hover:shadow-black/20 active:scale-[0.998]"
      onClick={() => navigate(`/post/${post.id}`)}
    >
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10 ring-2 ring-border/30 group-hover:ring-primary/20 transition-all">
            <AvatarImage src={post.profiles.profile_picture || ""} alt={post.profiles.name} />
            <AvatarFallback className="bg-gradient-primary text-primary-foreground font-bold text-sm">
              {post.profiles.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm truncate">{post.profiles.name}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide ${config.bg} ${config.color}`}>
                <CategoryIcon className="h-2.5 w-2.5" />
                {config.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <span>{formatTimestamp(post.created_at)}</span>
              {post.profiles.rating > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-0.5">
                    <span className="text-amber-500 text-[10px]">★</span>
                    <span className="font-medium text-foreground/70">{post.profiles.rating.toFixed(1)}</span>
                  </span>
                </>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-xl">
              <DropdownMenuItem onClick={copyLink} className="rounded-lg text-xs">
                <Copy className="mr-2 h-3.5 w-3.5" /> Copy link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="rounded-lg text-xs">
                <Bookmark className="mr-2 h-3.5 w-3.5" /> Save post
              </DropdownMenuItem>
              {isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/edit-post/${post.id}`); }} className="rounded-lg text-xs">
                    <Edit className="mr-2 h-3.5 w-3.5" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => onDelete(post.id, e)} className="text-destructive rounded-lg text-xs">
                    <Trash className="mr-2 h-3.5 w-3.5" /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Content */}
        <div className="mb-3">
          <h3 className="text-base sm:text-lg font-bold leading-snug tracking-tight mb-1.5 group-hover:text-primary transition-colors">
            {post.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {post.description}
          </p>
        </div>

        {/* AI Summary */}
        {post.ai_summary && (
          <div className="mb-3 flex items-start gap-1.5 bg-primary/5 dark:bg-primary/8 px-3 py-2 rounded-xl">
            <Sparkles className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
            <span className="text-xs text-primary/80 italic line-clamp-2 leading-relaxed">{post.ai_summary}</span>
          </div>
        )}

        {/* Campus Highlight */}
        {post.campus_highlight && (
          <div className="mb-3 px-3 py-2 bg-accent/5 rounded-xl border border-accent/10 flex items-start gap-2">
            <Sparkles className="h-3.5 w-3.5 text-accent mt-0.5 flex-shrink-0" />
            <p className="text-xs text-foreground/80 leading-relaxed">{post.campus_highlight}</p>
          </div>
        )}

        {/* Image */}
        {post.image_url && (
          <div className="mb-3 rounded-xl overflow-hidden border border-border/20">
            <img
              src={post.image_url}
              alt={post.title}
              loading="lazy"
              decoding="async"
              className="w-full max-h-[380px] object-cover"
            />
          </div>
        )}

        {/* Price & Tags */}
        {(post.optional_price || (post.tags && post.tags.length > 0)) && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {post.optional_price != null && (
              <span className="inline-flex items-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2.5 py-1 rounded-lg text-xs">
                ₦{post.optional_price.toLocaleString()}
              </span>
            )}
            {post.tags?.slice(0, 3).map((tag, i) => (
              <span key={i} className="text-xs font-medium text-primary/50">#{tag}</span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border/30">
          <div className="flex items-center gap-1">
            <button
              className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-sm transition-all ${
                isLiked
                  ? 'bg-red-500/10 text-red-500'
                  : 'hover:bg-red-500/5 hover:text-red-500 text-muted-foreground'
              }`}
              onClick={(e) => onLike(post.id, e)}
            >
              <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
              <span className="font-semibold text-xs">{likeCount || ''}</span>
            </button>
            <button
              className="flex items-center gap-1.5 h-8 px-3 rounded-full text-sm text-muted-foreground hover:bg-primary/5 hover:text-primary transition-all"
              onClick={(e) => { e.stopPropagation(); navigate(`/post/${post.id}`); }}
            >
              <MessageSquare className="h-4 w-4" />
              <span className="font-semibold text-xs">{post.comment_count || ''}</span>
            </button>
            <button
              className="flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:bg-primary/5 hover:text-primary transition-all"
              onClick={(e) => onShare(post.id, post.title, post.description, e)}
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          {!isOwner && (
            <Button
              size="sm"
              className="h-8 rounded-full px-4 gap-1.5 bg-gradient-primary text-white text-xs font-semibold shadow-sm shadow-primary/15 hover:shadow-primary/25 hover:scale-[1.03] active:scale-[0.97] transition-all"
              onClick={(e) => { e.stopPropagation(); navigate(`/messages?userId=${post.user_id}&postId=${post.id}`); }}
            >
              <ActionIcon className="h-3.5 w-3.5" />
              {config.action}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
});

PostCard.displayName = 'PostCard';
