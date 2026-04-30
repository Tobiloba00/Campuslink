import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  BookOpen, Users, ShoppingBag, Star, MessageSquare,
  ArrowLeft, Edit, Trash, MoreHorizontal, Heart, Share2, Copy,
  Tag, Calendar, Wallet, Sparkles
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Comments } from "@/components/Comments";
import { format } from "date-fns";
import BottomNav from "@/components/BottomNav";

type Post = {
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
  due_date?: string | null;
  profiles: {
    name: string;
    rating: number;
    email: string;
    profile_picture: string | null;
    course?: string | null;
  };
};

const CATEGORY_LABEL: Record<string, string> = {
  'Academic Help': 'Academic Help',
  'Tutoring': 'Tutoring',
  'Buy & Sell': 'Buy & Sell',
};

const CATEGORY_ICON: Record<string, typeof BookOpen> = {
  'Academic Help': BookOpen,
  'Tutoring': Users,
  'Buy & Sell': ShoppingBag,
};

const PRIMARY_CTA: Record<string, string> = {
  'Academic Help': 'I Can Help',
  'Tutoring': 'Book Session',
  'Buy & Sell': 'Make Offer',
};

// "May 25, 2024 (Tomorrow)" / "(Today)" / "(Overdue)" / "(In 3 days)"
const formatDeadline = (iso: string): { absolute: string; qualifier: string; urgent: boolean } => {
  const date = new Date(iso);
  const absolute = format(date, "MMM d, yyyy");
  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / 86400000);

  if (diffMs < 0) return { absolute, qualifier: 'Overdue', urgent: true };
  if (diffDays === 0) return { absolute, qualifier: 'Today', urgent: true };
  if (diffDays === 1) return { absolute, qualifier: 'Tomorrow', urgent: true };
  if (diffDays <= 7) return { absolute, qualifier: `In ${diffDays} days`, urgent: diffDays <= 2 };
  return { absolute, qualifier: '', urgent: false };
};

const PostDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) navigate("/auth");
    });
  }, [navigate]);

  useEffect(() => {
    if (id && user) {
      fetchPost();
      fetchLikeStatus();
    }
  }, [id, user]);

  const fetchPost = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('posts')
      .select('id, title, description, category, optional_price, ai_summary, image_url, created_at, user_id, tags, campus_highlight, due_date, profiles (name, rating, email, profile_picture, course)')
      .eq('id', id)
      .single();

    if (error) {
      // Distinguish "doesn't exist" from "couldn't load"
      if (error.code === "PGRST116" || /no rows/i.test(error.message)) {
        navigate("/not-found", { replace: true });
      } else {
        toast.error("Failed to load post");
        navigate("/feed");
      }
      return;
    }
    setPost(data as Post);
    setLoading(false);
  };

  const fetchLikeStatus = async () => {
    if (!id || !user) return;
    const [likeCheck, countResult] = await Promise.all([
      supabase.from('post_likes').select('id').eq('post_id', id).eq('user_id', user.id).maybeSingle(),
      supabase.from('post_likes').select('id', { count: 'exact', head: true }).eq('post_id', id)
    ]);
    setIsLiked(!!likeCheck.data);
    setLikeCount(countResult.count || 0);
  };

  const toggleLike = useCallback(async () => {
    if (!user || !id) return;
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount(prev => prev + (wasLiked ? -1 : 1));

    try {
      if (wasLiked) {
        await supabase.from('post_likes').delete().eq('post_id', id).eq('user_id', user.id);
      } else {
        await supabase.from('post_likes').insert({ post_id: id, user_id: user.id });
      }
    } catch {
      setIsLiked(wasLiked);
      setLikeCount(prev => prev + (wasLiked ? 1 : -1));
      toast.error("Failed to update like");
    }
  }, [user, id, isLiked]);

  const handleShare = async () => {
    if (!post) return;
    const url = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: post.title, text: post.description.slice(0, 120), url }); return; }
      catch { /* fall through to clipboard */ }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copied!");
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied!");
  };

  const handleDelete = async () => {
    if (!confirm("Delete this post? This will also delete all comments.")) return;
    try {
      if (post?.image_url) {
        const path = post.image_url.split("/").slice(-3).join("/");
        await supabase.storage.from("post-images").remove([path]);
      }
      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) throw error;
      toast.success("Post deleted");
      navigate("/feed");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading || !post || !user) return null;

  const isOwner = user.id === post.user_id;
  const CategoryIcon = CATEGORY_ICON[post.category] || BookOpen;
  const categoryLabel = CATEGORY_LABEL[post.category] || post.category;
  const ctaLabel = PRIMARY_CTA[post.category] || 'I Can Help';
  const deadline = post.due_date ? formatDeadline(post.due_date) : null;
  const subject = post.tags && post.tags.length > 0 ? post.tags[0] : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop keeps the global Navbar; mobile uses a slim page header (matches mockup) */}
      <div className="hidden lg:block">
        <Navbar />
      </div>

      {/* Mobile page header — back + overflow menu, like the mockup */}
      <header
        className="lg:hidden sticky top-0 z-30 bg-background/85 backdrop-blur-xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="h-12 px-2 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-10 w-10 rounded-full hover:bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-muted" aria-label="More">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl">
              <DropdownMenuItem onClick={toggleLike} className="rounded-lg text-sm">
                <Heart className={`mr-2 h-4 w-4 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                {isLiked ? 'Unlike' : 'Like'} {likeCount > 0 && `(${likeCount})`}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyLink} className="rounded-lg text-sm">
                <Copy className="mr-2 h-4 w-4" /> Copy link
              </DropdownMenuItem>
              {isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(`/edit-post/${id}`)} className="rounded-lg text-sm">
                    <Edit className="mr-2 h-4 w-4" /> Edit post
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDelete} className="rounded-lg text-sm text-destructive focus:text-destructive">
                    <Trash className="mr-2 h-4 w-4" /> Delete post
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pb-32 lg:pt-[88px] lg:pb-12">
        <article className="pt-5">
          {/* Title */}
          <h1 className="text-[22px] sm:text-3xl font-extrabold tracking-tight leading-tight text-foreground">
            {post.title}
          </h1>

          {/* Price + urgency row */}
          {(post.optional_price != null || deadline) && (
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2">
              {post.optional_price != null && (
                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-base">
                  ₦{post.optional_price.toLocaleString()}
                </span>
              )}
              {deadline && deadline.qualifier && (
                <>
                  {post.optional_price != null && <span className="text-muted-foreground/40">•</span>}
                  <span className={`text-sm font-semibold ${deadline.urgent ? 'text-red-500' : 'text-muted-foreground'}`}>
                    Due {deadline.qualifier}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Author card */}
          <div className="flex items-center gap-3 mt-5 py-4 border-y border-border/40">
            <Avatar className="h-11 w-11 ring-1 ring-border/40">
              <AvatarImage src={post.profiles.profile_picture || ""} alt={post.profiles.name} />
              <AvatarFallback className="bg-gradient-primary text-primary-foreground font-bold">
                {post.profiles.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[15px] truncate">{post.profiles.name}</p>
              {post.profiles.course && (
                <p className="text-xs text-muted-foreground truncate">{post.profiles.course}</p>
              )}
            </div>
            {post.profiles.rating > 0 && (
              <div className="flex items-center gap-1 text-sm flex-shrink-0">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-semibold">{post.profiles.rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* About the task */}
          <section className="mt-6">
            <h2 className="text-[15px] font-bold mb-2.5">About the task</h2>
            <p className="text-[15px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
              {post.description}
            </p>

            {post.ai_summary && (
              <div className="flex items-start gap-2 bg-primary/5 px-3.5 py-2.5 rounded-xl mt-4">
                <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-[13px] text-primary/80 italic leading-relaxed">{post.ai_summary}</p>
              </div>
            )}

            {post.campus_highlight && (
              <div className="flex items-start gap-2 bg-accent/5 px-3.5 py-2.5 rounded-xl border border-accent/10 mt-3">
                <Sparkles className="h-3.5 w-3.5 text-accent mt-0.5 flex-shrink-0" />
                <p className="text-[13px] text-foreground/80 leading-relaxed">{post.campus_highlight}</p>
              </div>
            )}
          </section>

          {/* Image, if any */}
          {post.image_url && (
            <div className="rounded-2xl overflow-hidden border border-border/30 mt-6">
              <img src={post.image_url} alt={post.title} className="w-full h-auto object-cover max-h-[600px]" loading="lazy" />
            </div>
          )}

          {/* Details */}
          <section className="mt-7">
            <h2 className="text-[15px] font-bold mb-3">Details</h2>
            <ul className="divide-y divide-border/40">
              <DetailRow icon={CategoryIcon} label="Category" value={categoryLabel} />
              {subject && <DetailRow icon={Tag} label="Subject" value={subject} />}
              {deadline && (
                <DetailRow
                  icon={Calendar}
                  label="Deadline"
                  value={`${deadline.absolute}${deadline.qualifier ? ` (${deadline.qualifier})` : ''}`}
                  valueClassName={deadline.urgent ? 'text-red-500 font-semibold' : ''}
                />
              )}
              {post.optional_price != null && (
                <DetailRow icon={Wallet} label="Budget" value={`₦${post.optional_price.toLocaleString()}`} />
              )}
            </ul>
          </section>

          {/* Action buttons */}
          <div className="mt-8 space-y-3">
            {isOwner ? (
              <Button
                onClick={() => navigate(`/edit-post/${id}`)}
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 font-semibold text-[15px] shadow-md shadow-primary/20"
              >
                <Edit className="h-4 w-4 mr-2" /> Edit Post
              </Button>
            ) : (
              <Button
                onClick={() => navigate(`/messages?userId=${post.user_id}&postId=${post.id}`)}
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 font-semibold text-[15px] shadow-md shadow-primary/20"
              >
                <MessageSquare className="h-4 w-4 mr-2" /> {ctaLabel}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleShare}
              className="w-full h-12 rounded-xl border-primary/40 text-primary hover:bg-primary/5 font-semibold text-[15px]"
            >
              <Share2 className="h-4 w-4 mr-2" /> Share Task
            </Button>
          </div>
        </article>

        {/* Comments */}
        <div className="mt-10">
          <Comments postId={id!} postTitle={post.title} postDescription={post.description} />
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

// Single row in the Details section
const DetailRow = ({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
  valueClassName?: string;
}) => (
  <li className="flex items-center gap-3 py-3">
    <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0">
      <Icon className="h-4 w-4 text-muted-foreground" />
    </div>
    <span className="text-sm text-muted-foreground flex-shrink-0 w-20">{label}</span>
    <span className={`text-sm font-medium text-foreground text-right flex-1 truncate ${valueClassName || ''}`}>
      {value}
    </span>
  </li>
);

export default PostDetail;
