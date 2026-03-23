import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus, Search, RefreshCw, BookOpen, GraduationCap, ShoppingBag,
  TrendingUp, Users, Sparkles
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FeedSkeleton } from "@/components/ui/skeleton-loaders";
import BottomNav from "@/components/BottomNav";
import { AIAssistant } from "@/components/AIAssistant";
import { PostCard } from "@/components/feed/PostCard";

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
  engagement_count: number;
  comment_count?: number;
  profiles: {
    name: string;
    rating: number;
    profile_picture: string | null;
  };
};

type TrendingTag = { tag: string; count: number; score?: number };
type TopHelper = { id: string; name: string; rating: number; profile_picture: string | null };

const Feed = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState("all");
  const [user, setUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const [lastSeenPostId, setLastSeenPostId] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>([]);
  const [topHelpers, setTopHelpers] = useState<TopHelper[]>([]);

  // ─── Auth ───
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) navigate("/auth");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) navigate("/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // ─── Data fetching ───
  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    let query = supabase
      .from('posts')
      .select('id, title, description, category, optional_price, ai_summary, image_url, created_at, user_id, tags, campus_highlight, engagement_count, profiles (name, rating, profile_picture), comments(count)')
      .order('created_at', { ascending: false });

    if (filter !== "all") {
      query = query.eq('category', filter as any);
    }

    const { data, error } = await query;
    if (error) { toast.error("Failed to load posts"); setIsLoading(false); return; }

    const formatted = data?.map(post => ({
      ...post,
      comment_count: (post as any).comments?.[0]?.count || 0
    }));

    setPosts(formatted || []);

    if (data && data.length > 0) {
      const postIds = data.map(p => p.id);
      const { data: likesData } = await supabase.from('post_likes').select('post_id').in('post_id', postIds);
      if (likesData) {
        const counts: Record<string, number> = {};
        likesData.forEach(like => { counts[like.post_id] = (counts[like.post_id] || 0) + 1; });
        setLikeCounts(counts);
      }
      setLastSeenPostId(data[0].id);
    }
    setIsLoading(false);
  }, [filter]); // Removed likedPosts dependency — was causing cascade refetches

  const fetchUserLikes = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('post_likes').select('post_id').eq('user_id', user.id);
    if (data) setLikedPosts(new Set(data.map(l => l.post_id)));
  }, [user]);

  const fetchTrendingTags = useCallback(async () => {
    // Velocity-weighted trending: recent tags score higher than older ones.
    // A tag from today is worth 4x more than one from 7 days ago.
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: tagPosts } = await supabase
      .from('posts').select('tags, created_at')
      .gte('created_at', sevenDaysAgo.toISOString())
      .not('tags', 'is', null);

    if (tagPosts && tagPosts.length > 0) {
      const now = Date.now();
      const tagScores: Record<string, number> = {};
      const tagRawCounts: Record<string, number> = {};

      tagPosts.forEach(p => {
        // Recency weight: posts from today score ~1.0, posts from 7 days ago score ~0.25
        const ageDays = (now - new Date(p.created_at).getTime()) / 86400000;
        const weight = Math.pow(0.75, ageDays); // exponential decay

        p.tags?.forEach((t: string) => {
          tagScores[t] = (tagScores[t] || 0) + weight;
          tagRawCounts[t] = (tagRawCounts[t] || 0) + 1;
        });
      });

      setTrendingTags(
        Object.entries(tagScores)
          .map(([tag, score]) => ({ tag, count: tagRawCounts[tag], score }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
      );
    }
  }, []);

  const fetchTopHelpers = useCallback(async () => {
    const { data } = await supabase.from('profiles')
      .select('id, name, rating, profile_picture')
      .not('rating', 'is', null).gt('rating', 0)
      .order('rating', { ascending: false }).limit(3);
    if (data) setTopHelpers(data);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchPosts();
    fetchUserLikes();
    fetchTrendingTags();
    fetchTopHelpers();
  }, [user, fetchPosts, fetchUserLikes, fetchTrendingTags, fetchTopHelpers]);

  // ─── Real-time ───
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('posts-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
        if (lastSeenPostId && payload.new.id !== lastSeenPostId) setHasNewPosts(true);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, () => fetchPosts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, lastSeenPostId, fetchPosts]);

  // ─── Handlers ───
  const toggleLike = useCallback(async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { toast.error("Please login to like posts"); return; }

    const isLiked = likedPosts.has(postId);
    // Optimistic
    setLikedPosts(prev => { const s = new Set(prev); isLiked ? s.delete(postId) : s.add(postId); return s; });
    setLikeCounts(prev => ({ ...prev, [postId]: (prev[postId] || 0) + (isLiked ? -1 : 1) }));

    try {
      if (isLiked) {
        await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      } else {
        await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
      }
    } catch {
      // Rollback
      setLikedPosts(prev => { const s = new Set(prev); isLiked ? s.add(postId) : s.delete(postId); return s; });
      setLikeCounts(prev => ({ ...prev, [postId]: (prev[postId] || 0) + (isLiked ? 1 : -1) }));
      toast.error("Failed to update like");
    }
  }, [user, likedPosts]);

  const handleShare = useCallback(async (postId: string, title: string, description: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/post/${postId}`;
    if (navigator.share) {
      try { await navigator.share({ title, text: description.substring(0, 100), url }); }
      catch { navigator.clipboard.writeText(url); toast.success("Link copied!"); }
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  }, []);

  const handleDelete = useCallback(async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', user.id);
    if (error) toast.error("Failed to delete post");
    else { toast.success("Post deleted"); fetchPosts(); }
  }, [user, fetchPosts]);

  // ─── Smart Ranking Algorithm v2 ───
  // Uses exponential time decay, logarithmic engagement, Bayesian rating confidence,
  // and comment weighting. Designed for a campus marketplace feed.
  const filteredPosts = useMemo(() => {
    const now = Date.now();
    const HOUR = 3600000;

    // ── Search with relevance weighting ──
    const searched = posts.map(post => {
      if (!searchQuery) return { post, searchRelevance: 0 };

      const q = searchQuery.toLowerCase();
      const titleMatch = post.title.toLowerCase().includes(q);
      const descMatch = post.description.toLowerCase().includes(q);
      const nameMatch = post.profiles.name.toLowerCase().includes(q);
      const tagMatch = post.tags?.some(t => t.toLowerCase().includes(q)) || false;

      if (!titleMatch && !descMatch && !nameMatch && !tagMatch) return null;

      // Weight: title > tags > name > description
      const searchRelevance = (titleMatch ? 1.0 : 0) + (tagMatch ? 0.6 : 0) + (nameMatch ? 0.4 : 0) + (descMatch ? 0.2 : 0);
      return { post, searchRelevance };
    }).filter(Boolean) as { post: Post; searchRelevance: number }[];

    return searched
      .map(({ post, searchRelevance }) => {
        // ── 1. Exponential time decay (half-life = 18 hours) ──
        // Posts lose 50% recency every 18 hours. A 2-day-old post scores ~0.10
        // Much more aggressive than linear — rewards fresh content strongly.
        const ageHours = (now - new Date(post.created_at).getTime()) / HOUR;
        const halfLife = 18;
        const recency = Math.pow(0.5, ageHours / halfLife); // 1.0 → 0.5 at 18h → 0.25 at 36h → 0.06 at 3d

        // ── 2. Logarithmic engagement (likes + comments) ──
        // log(1 + likes + comments*2) — comments weighted 2x because they require more effort.
        // Logarithmic scaling means going from 0→5 likes matters more than 50→55.
        const likes = likeCounts[post.id] || 0;
        const comments = post.comment_count || 0;
        const rawEngagement = likes + comments * 2;
        const engagement = rawEngagement > 0 ? Math.log10(1 + rawEngagement) / Math.log10(100) : 0;
        // Normalized: log10(1+x)/log10(100) → 0 at 0 engagements, ~0.5 at 9, 1.0 at 99

        // ── 3. Bayesian average rating (confidence-weighted) ──
        // A 5.0 from 1 review shouldn't outrank 4.2 from 50 reviews.
        // Uses Bayesian average: (C*m + sum_ratings) / (C + n)
        // where C = confidence threshold (3 reviews), m = platform prior (3.0)
        const userRating = post.profiles.rating || 0;
        const C = 3; // minimum reviews before we trust the rating
        const m = 3.0; // platform average assumption
        // We don't have review count per-user here, so we approximate:
        // if rating > 0, assume at least 1 review. Rating = 0 means no reviews.
        const hasReviews = userRating > 0;
        const bayesianRating = hasReviews
          ? (C * m + userRating) / (C + 1) // Conservative: pulls toward 3.0
          : m; // No reviews → use platform average
        const ratingScore = (bayesianRating - 1) / 4; // Normalize 1-5 → 0-1

        // ── 4. Content quality signal ──
        // Has image (+0.05), has AI summary (+0.03), has tags (+0.02)
        const qualityBonus =
          (post.image_url ? 0.05 : 0) +
          (post.ai_summary ? 0.03 : 0) +
          (post.tags && post.tags.length > 0 ? 0.02 : 0);

        // ── 5. Final score ──
        // Weights: recency 45%, engagement 30%, rating 15%, quality 10%
        let score = recency * 0.45 + engagement * 0.30 + ratingScore * 0.15 + qualityBonus;

        // If searching, blend in search relevance (30% search, 70% ranking)
        if (searchQuery) {
          score = searchRelevance * 0.30 + score * 0.70;
        }

        return { ...post, _score: score };
      })
      .sort((a, b) => b._score - a._score);
  }, [posts, searchQuery, likeCounts]);

  if (!user) return null;

  const FILTER_OPTIONS = [
    { key: 'all', label: 'All', icon: Sparkles },
    { key: 'Academic Help', label: 'Academic', icon: BookOpen },
    { key: 'Tutoring', label: 'Tutoring', icon: GraduationCap },
    { key: 'Buy & Sell', label: 'Market', icon: ShoppingBag },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* New posts toast */}
      {hasNewPosts && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top">
          <Button
            onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setHasNewPosts(false); fetchPosts(); }}
            className="shadow-2xl shadow-primary/30 rounded-full bg-gradient-primary hover:scale-105 active:scale-95 transition-all text-sm font-semibold"
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> New posts available
          </Button>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-4 pt-[72px] pb-24 lg:pb-8">
        <div className="flex gap-8 justify-center">
          {/* ─── Left Sidebar ─── */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-[72px] space-y-5 pt-1">
              <div className="space-y-1">
                {FILTER_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setFilter(opt.key)}
                    className={`w-full flex items-center gap-3 h-10 px-4 rounded-xl text-sm font-medium transition-all ${
                      filter === opt.key
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    }`}
                  >
                    <opt.icon className="h-4 w-4" />
                    {opt.key === 'all' ? 'Discovery' : opt.key === 'Buy & Sell' ? 'Marketplace' : opt.key}
                  </button>
                ))}
              </div>

              <Button className="w-full h-11 font-semibold rounded-xl bg-gradient-primary shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all" asChild>
                <Link to="/create-post">
                  <Plus className="h-4 w-4 mr-2" /> Create Post
                </Link>
              </Button>
            </div>
          </aside>

          {/* ─── Main Feed ─── */}
          <main className="w-full max-w-[600px]">
            {/* Search */}
            <div className="sticky top-[56px] z-30 bg-background/80 backdrop-blur-xl pb-3 pt-4 -mx-1 px-1">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search posts, people, tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-muted/50 border-border/30 focus:bg-background focus:border-primary/30 rounded-xl text-sm transition-all"
                />
              </div>

              {/* Mobile Filter Pills */}
              <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide lg:hidden">
                {FILTER_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setFilter(opt.key)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                      filter === opt.key
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <opt.icon className="h-3 w-3" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Posts */}
            {isLoading ? (
              <FeedSkeleton />
            ) : (
              <div className="space-y-4 mt-1">
                {filteredPosts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    isLiked={likedPosts.has(post.id)}
                    likeCount={likeCounts[post.id] || 0}
                    isOwner={post.user_id === user?.id}
                    onLike={toggleLike}
                    onDelete={handleDelete}
                    onShare={handleShare}
                  />
                ))}

                {filteredPosts.length === 0 && searchQuery && (
                  <div className="rounded-2xl border border-border/30 p-10 text-center">
                    <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                      <Search className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                    <p className="font-semibold text-sm mb-1">No results for "{searchQuery}"</p>
                    <p className="text-xs text-muted-foreground">Try different keywords</p>
                  </div>
                )}
              </div>
            )}

            {!isLoading && posts.length === 0 && (
              <div className="rounded-2xl border border-border/30 p-12 text-center mt-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-bold mb-2">No posts yet</h3>
                <p className="text-sm text-muted-foreground mb-5">Be the first to create a post!</p>
                <Button asChild className="rounded-full px-6 bg-gradient-primary shadow-lg shadow-primary/20">
                  <Link to="/create-post"><Plus className="h-4 w-4 mr-2" /> Create post</Link>
                </Button>
              </div>
            )}
          </main>

          {/* ─── Right Sidebar ─── */}
          <aside className="hidden xl:block w-64 flex-shrink-0">
            <div className="sticky top-[72px] space-y-5 pt-1">
              {/* Campus Pulse */}
              <div className="rounded-2xl border border-border/30 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-accent/10 rounded-lg">
                    <TrendingUp className="h-3.5 w-3.5 text-accent" />
                  </div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Campus Pulse</h3>
                </div>
                {trendingTags.length > 0 ? (
                  <div className="space-y-3">
                    {trendingTags.map((item, i) => (
                      <button
                        key={item.tag}
                        className="w-full flex items-center justify-between group text-left"
                        onClick={() => setSearchQuery(item.tag)}
                      >
                        <div>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">
                            {i === 0 ? '🔥 Trending' : i === 1 ? '✨ Rising' : '📍 Popular'}
                          </p>
                          <p className="font-bold text-sm group-hover:text-primary transition-colors">#{item.tag}</p>
                        </div>
                        <span className="text-[10px] font-bold bg-primary/5 px-2 py-0.5 rounded-md text-primary">{item.count}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-3">No trending topics yet</p>
                )}
              </div>

              {/* Top Helpers */}
              <div className="rounded-2xl border border-border/30 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-primary/10 rounded-lg">
                    <Users className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Top Helpers</h3>
                </div>
                {topHelpers.length > 0 ? (
                  <div className="space-y-3">
                    {topHelpers.map(helper => (
                      <button
                        key={helper.id}
                        className="w-full flex items-center gap-3 group text-left"
                        onClick={() => navigate(`/messages?userId=${helper.id}`)}
                      >
                        <Avatar className="h-8 w-8 ring-1 ring-border/30 group-hover:ring-primary/20 transition-all">
                          <AvatarImage src={helper.profile_picture || ""} />
                          <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs font-bold">
                            {helper.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{helper.name}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <span className="text-amber-500">★</span> {helper.rating.toFixed(1)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-3">No top helpers yet</p>
                )}
                <button
                  onClick={() => navigate('/leaderboard')}
                  className="w-full mt-4 h-8 text-xs font-semibold text-primary hover:bg-primary/5 rounded-lg transition-colors"
                >
                  View All Helpers
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <BottomNav />
      <AIAssistant />
    </div>
  );
};

export default Feed;
