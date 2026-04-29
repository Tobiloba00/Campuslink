import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, Check } from "lucide-react";
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
    due_date?: string | null;
    profiles: {
      name: string;
      rating: number;
      profile_picture: string | null;
      course?: string | null;
    };
  };
  isLiked: boolean;
  likeCount: number;
  isOwner: boolean;
  onLike: (postId: string, e: React.MouseEvent) => void;
  onDelete: (postId: string, e: React.MouseEvent) => void;
  onShare: (postId: string, title: string, description: string, e: React.MouseEvent) => void;
}

const CATEGORY_META: Record<string, { badge: string; tag: string; tagColor: string; cta: string }> = {
  'Academic Help': { badge: 'Help Needed', tag: 'HELP NEEDED', tagColor: 'text-blue-600 dark:text-blue-400', cta: 'I Can Help' },
  'Tutoring':      { badge: 'Tutoring',    tag: 'TUTORING',    tagColor: 'text-emerald-600 dark:text-emerald-400', cta: 'Book Session' },
  'Buy & Sell':    { badge: 'For Sale',    tag: 'FOR SALE',    tagColor: 'text-amber-600 dark:text-amber-400', cta: 'Message Seller' },
};

const formatTimestamp = (timestamp: string) => {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatUrgency = (iso: string | null | undefined): { label: string; urgent: boolean } | null => {
  if (!iso) return null;
  const due = new Date(iso).getTime();
  const diffMs = due - Date.now();
  const diffDays = Math.ceil(diffMs / 86400000);
  if (diffMs < 0) return { label: 'Overdue', urgent: true };
  if (diffDays === 0) return { label: 'Due today', urgent: true };
  if (diffDays === 1) return { label: 'Due tomorrow', urgent: true };
  if (diffDays <= 7) return { label: `Due in ${diffDays} days`, urgent: diffDays <= 2 };
  return null;
};

export const PostCard = memo(({ post, isLiked, likeCount, isOwner, onLike, onShare }: PostCardProps) => {
  const navigate = useNavigate();
  const meta = CATEGORY_META[post.category] || CATEGORY_META['Academic Help'];
  const urgency = formatUrgency(post.due_date);
  const hasImage = !!post.image_url;

  const goToDetail = () => navigate(`/post/${post.id}`);
  const goToMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/messages?userId=${post.user_id}&postId=${post.id}`);
  };
  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLike(post.id, e);
  };
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/edit-post/${post.id}`);
  };

  return (
    <article
      className="bg-card border border-border/50 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:border-border hover:shadow-md hover:shadow-black/[0.04] dark:hover:shadow-black/20 active:scale-[0.997]"
      onClick={goToDetail}
    >
      {/* Hero image (only when post has one) — overlays for category badge + heart */}
      {hasImage && (
        <div className="relative w-full aspect-[16/11] bg-muted overflow-hidden">
          <img
            src={post.image_url!}
            alt={post.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />

          {/* Top-left category badge: "✓ For Sale" / "✓ Help Needed" / etc. */}
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-emerald-500 text-white font-semibold text-[11px] px-2 py-1 rounded-full shadow-sm">
            <Check className="h-3 w-3" strokeWidth={3} />
            {meta.badge}
          </span>

          {/* Top-right heart (like) */}
          <button
            onClick={handleLike}
            className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/95 dark:bg-background/95 backdrop-blur flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-transform"
            aria-label={isLiked ? 'Unlike' : 'Like'}
          >
            <Heart
              className={`h-[18px] w-[18px] transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-foreground/60'}`}
            />
          </button>
        </div>
      )}

      <div className="p-4">
        {/* Category tag + price row */}
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <span className={`text-[11px] font-bold tracking-wider uppercase ${meta.tagColor}`}>
            {meta.tag}
          </span>
          <div className="flex items-center gap-2">
            {/* Heart for image-less posts (image-posts already have it on overlay) */}
            {!hasImage && (
              <button
                onClick={handleLike}
                className="p-1 rounded-full hover:bg-muted transition-colors"
                aria-label={isLiked ? 'Unlike' : 'Like'}
              >
                <Heart
                  className={`h-[18px] w-[18px] ${isLiked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`}
                />
              </button>
            )}
            {post.optional_price != null && (
              <span className="text-primary font-bold text-[15px]">
                ₦{post.optional_price.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-[15.5px] font-bold leading-snug tracking-tight text-foreground">
          {post.title}
        </h3>

        {/* Description */}
        <p className="text-[13.5px] text-muted-foreground leading-relaxed line-clamp-2 mt-1.5">
          {post.description}
        </p>

        {/* Urgency line — red when due soon, only when there's a deadline */}
        {urgency && (
          <p className={`text-[12px] font-semibold mt-2 ${urgency.urgent ? 'text-red-500' : 'text-muted-foreground'}`}>
            {urgency.label}
          </p>
        )}

        {/* Author row */}
        <div className="flex items-center gap-2.5 mt-3 pb-3">
          <Avatar className="h-7 w-7 flex-shrink-0">
            <AvatarImage src={post.profiles.profile_picture || ""} alt={post.profiles.name} />
            <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-bold">
              {post.profiles.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 leading-tight">
            <p className="text-[13px] font-semibold truncate">{post.profiles.name}</p>
            {post.profiles.course && (
              <p className="text-[11px] text-muted-foreground truncate">{post.profiles.course}</p>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0">
            {formatTimestamp(post.created_at)}
          </span>
        </div>

        {/* Action row — outlined "View Details" + filled CTA */}
        <div className="flex items-center gap-2 pt-3 border-t border-border/40">
          <Button
            variant="outline"
            onClick={(e) => { e.stopPropagation(); goToDetail(); }}
            className="flex-1 h-10 rounded-xl border-border/60 text-foreground hover:bg-muted text-[13px] font-semibold"
          >
            View Details
          </Button>
          {isOwner ? (
            <Button
              onClick={handleEdit}
              className="flex-1 h-10 rounded-xl bg-primary hover:bg-primary/90 text-[13px] font-semibold shadow-sm shadow-primary/20"
            >
              Edit Post
            </Button>
          ) : (
            <Button
              onClick={goToMessage}
              className="flex-1 h-10 rounded-xl bg-primary hover:bg-primary/90 text-[13px] font-semibold shadow-sm shadow-primary/20"
            >
              {meta.cta}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
});

PostCard.displayName = 'PostCard';
