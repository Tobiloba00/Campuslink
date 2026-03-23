import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, GraduationCap, ShoppingBag, Star, MessageSquare,
  ArrowLeft, Edit, Trash, Share2, Heart, Sparkles, Clock
} from "lucide-react";
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
  profiles: {
    name: string;
    rating: number;
    email: string;
    profile_picture: string | null;
  };
};

const CATEGORY_CONFIG: Record<string, { icon: typeof BookOpen; color: string; bg: string; label: string }> = {
  'Academic Help': { icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Academic Help' },
  'Tutoring': { icon: GraduationCap, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Tutoring' },
  'Buy & Sell': { icon: ShoppingBag, color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'Buy & Sell' },
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
      .select('id, title, description, category, optional_price, ai_summary, image_url, created_at, user_id, tags, campus_highlight, profiles (name, rating, email, profile_picture)')
      .eq('id', id)
      .single();

    if (error) {
      toast.error("Failed to load post");
      navigate("/feed");
      return;
    }
    setPost(data);
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

  const handleShare = () => {
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
  const config = CATEGORY_CONFIG[post.category] || CATEGORY_CONFIG['Academic Help'];
  const CategoryIcon = config.icon;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-20 pb-32 lg:pb-8">
        {/* Back */}
        <button
          onClick={() => navigate("/feed")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 mt-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to feed
        </button>

        {/* Post */}
        <article className="mb-8">
          {/* Author */}
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-12 w-12 ring-2 ring-border/30">
              <AvatarImage src={post.profiles.profile_picture || ""} />
              <AvatarFallback className="bg-gradient-primary text-primary-foreground font-bold">
                {post.profiles.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold">{post.profiles.name}</span>
                {post.profiles.rating > 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {post.profiles.rating.toFixed(1)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{format(new Date(post.created_at), "MMM d, yyyy · h:mm a")}</span>
              </div>
            </div>
          </div>

          {/* Category */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${config.bg} ${config.color} text-xs font-semibold mb-4`}>
            <CategoryIcon className="h-3 w-3" />
            {config.label}
          </div>

          {/* Title & Description */}
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-tight mb-3">{post.title}</h1>
          <p className="text-[15px] sm:text-base leading-relaxed text-foreground/90 whitespace-pre-wrap mb-4">{post.description}</p>

          {/* AI Summary */}
          {post.ai_summary && (
            <div className="flex items-start gap-2 bg-primary/5 px-4 py-3 rounded-xl mb-4">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm text-primary/80 italic leading-relaxed">{post.ai_summary}</p>
            </div>
          )}

          {/* Campus Highlight */}
          {post.campus_highlight && (
            <div className="flex items-start gap-2 bg-accent/5 px-4 py-3 rounded-xl border border-accent/10 mb-4">
              <Sparkles className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
              <p className="text-sm text-foreground/80 leading-relaxed">{post.campus_highlight}</p>
            </div>
          )}

          {/* Image */}
          {post.image_url && (
            <div className="rounded-2xl overflow-hidden border border-border/20 mb-4">
              <img src={post.image_url} alt={post.title} className="w-full h-auto object-cover max-h-[600px]" loading="lazy" />
            </div>
          )}

          {/* Price & Tags */}
          {(post.optional_price || (post.tags && post.tags.length > 0)) && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.optional_price != null && (
                <span className="inline-flex items-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-3 py-1 rounded-lg text-sm">
                  ₦{post.optional_price.toLocaleString()}
                </span>
              )}
              {post.tags?.map((tag, i) => (
                <span key={i} className="text-xs font-medium text-primary/60 bg-primary/5 px-2 py-1 rounded-md">#{tag}</span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 py-3 border-y border-border/30">
            <div className="flex items-center gap-1">
              <button
                onClick={toggleLike}
                className={`flex items-center gap-1.5 h-9 px-3 rounded-full text-sm transition-all ${
                  isLiked ? 'bg-red-500/10 text-red-500' : 'hover:bg-red-500/5 hover:text-red-500 text-muted-foreground'
                }`}
              >
                <Heart className={`h-4.5 w-4.5 ${isLiked ? 'fill-current' : ''}`} />
                <span className="font-semibold text-xs">{likeCount || ''}</span>
              </button>
              <button
                onClick={() => document.getElementById('comment-input')?.focus()}
                className="flex items-center h-9 w-9 justify-center rounded-full text-muted-foreground hover:bg-primary/5 hover:text-primary transition-all"
              >
                <MessageSquare className="h-4.5 w-4.5" />
              </button>
              <button
                onClick={handleShare}
                className="flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:bg-primary/5 hover:text-primary transition-all"
              >
                <Share2 className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {!isOwner && (
                <Button
                  size="sm"
                  className="h-8 sm:h-9 rounded-full px-3 sm:px-4 bg-gradient-primary text-white text-[11px] sm:text-xs font-semibold shadow-sm"
                  onClick={() => navigate(`/messages?userId=${post.user_id}&postId=${post.id}`)}
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1" />
                  Message
                </Button>
              )}
              {isOwner && (
                <>
                  <Button variant="outline" size="sm" className="h-8 sm:h-9 rounded-full text-[11px] sm:text-xs px-3" onClick={() => navigate(`/edit-post/${id}`)}>
                    <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 sm:h-9 rounded-full text-[11px] sm:text-xs px-3 text-destructive hover:bg-destructive/10" onClick={handleDelete}>
                    <Trash className="h-3.5 w-3.5 mr-1" /> Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </article>

        {/* Comments */}
        <Comments postId={id!} postTitle={post.title} postDescription={post.description} />
      </div>
      <BottomNav />
    </div>
  );
};

export default PostDetail;
