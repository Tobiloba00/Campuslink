import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, RefreshCw, MessageCircle, Heart, Share2,
  MoreHorizontal, Copy, Flag, EyeOff, Trash, Edit,
  BookOpen, GraduationCap, ShoppingBag, TrendingUp, Users, Sparkles,
  MessageSquare, Bookmark
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { FeedSkeleton } from "@/components/ui/skeleton-loaders";
import BottomNav from "@/components/BottomNav";
import { AIAssistant } from "@/components/AIAssistant";

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

type TrendingTag = {
  tag: string;
  count: number;
};

type TopHelper = {
  id: string;
  name: string;
  rating: number;
  profile_picture: string | null;
};

const Feed = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [user, setUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const [lastSeenPostId, setLastSeenPostId] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>([]);
  const [topHelpers, setTopHelpers] = useState<TopHelper[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchPosts();
      fetchUserLikes();
      fetchTrendingTags();
      fetchTopHelpers();
    }

    const channel = supabase
      .channel('posts-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
        const newPost = payload.new;
        if (lastSeenPostId && newPost.id !== lastSeenPostId) {
          setHasNewPosts(true);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, () => fetchPosts())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, () => fetchPosts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [filter, lastSeenPostId, user]);

  const fetchUserLikes = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from('post_likes').select('post_id').eq('user_id', user.id);
    if (!error && data) {
      setLikedPosts(new Set(data.map(like => like.post_id)));
    }
  }, [user]);

  const fetchTrendingTags = useCallback(async () => {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: posts } = await supabase
        .from('posts')
        .select('tags')
        .gte('created_at', sevenDaysAgo.toISOString())
        .not('tags', 'is', null);

      if (posts && posts.length > 0) {
        const tagCounts: Record<string, number> = {};
        posts.forEach(post => {
          post.tags?.forEach((tag: string) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        });

        const sortedTags = Object.entries(tagCounts)
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setTrendingTags(sortedTags);
      }
    } catch (error) {
      console.error('Error fetching trending tags:', error);
    }
  }, []);

  const fetchTopHelpers = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, rating, profile_picture')
        .not('rating', 'is', null)
        .gt('rating', 0)
        .order('rating', { ascending: false })
        .limit(3);

      if (data) {
        setTopHelpers(data);
      }
    } catch (error) {
      console.error('Error fetching top helpers:', error);
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    let query = supabase
      .from('posts')
      .select(`id, title, description, category, optional_price, ai_summary, image_url, created_at, user_id, tags, campus_highlight, engagement_count, profiles (name, rating, profile_picture), comments(count)`)
      .order('created_at', { ascending: false });

    if (filter !== "all") {
      query = query.eq('category', filter as any);
    }

    const { data, error } = await query;
    if (error) {
      toast.error("Failed to load posts");
      setIsLoading(false);
      return;
    }

    const formattedData = data?.map(post => ({
      ...post,
      comment_count: (post as any).comments?.[0]?.count || 0
    }));

    setPosts(formattedData || []);

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
  }, [filter, likedPosts]);

  const toggleLike = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { toast.error("Please login to like posts"); return; }

    const isLiked = likedPosts.has(postId);
    setLikedPosts(prev => {
      const newSet = new Set(prev);
      isLiked ? newSet.delete(postId) : newSet.add(postId);
      return newSet;
    });
    setLikeCounts(prev => ({ ...prev, [postId]: (prev[postId] || 0) + (isLiked ? -1 : 1) }));

    try {
      if (isLiked) {
        await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      } else {
        await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
      }
    } catch {
      setLikedPosts(prev => {
        const newSet = new Set(prev);
        isLiked ? newSet.add(postId) : newSet.delete(postId);
        return newSet;
      });
      setLikeCounts(prev => ({ ...prev, [postId]: (prev[postId] || 0) + (isLiked ? 1 : -1) }));
      toast.error("Failed to update like");
    }
  };

  const handleShare = async (post: Post, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: post.title, text: post.description.substring(0, 100), url }); }
      catch { await copyToClipboard(url); }
    } else { await copyToClipboard(url); }
  };

  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("Link copied!"); }
    catch { toast.error("Failed to copy link"); }
  };

  const handleDeletePost = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this post?")) return;
    const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', user.id);
    if (error) { toast.error("Failed to delete post"); }
    else { toast.success("Post deleted"); fetchPosts(); }
  };

  const filteredPosts = useMemo(() => {
    const now = Date.now();

    return posts
      .filter(post => {
        const matchesSearch = searchQuery === "" ||
          post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          post.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          post.profiles.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          post.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesSearch;
      })
      .map(post => {
        // AI smart scoring — weights: recency 40%, engagement 30%, rating 20%, ai_summary bonus 10%
        const ageMs = now - new Date(post.created_at).getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        const recencyScore = Math.max(0, 1 - ageDays / 30); // decay over 30 days
        const engagementScore = Math.min(1, (likeCounts[post.id] || 0) / 20); // normalised to 20 likes
        const ratingScore = (post.profiles.rating || 0) / 5;
        const aiBonus = post.ai_summary ? 0.1 : 0;
        const smartScore = recencyScore * 0.4 + engagementScore * 0.3 + ratingScore * 0.2 + aiBonus;
        return { ...post, _smartScore: smartScore };
      })
      .sort((a, b) => (b._smartScore ?? 0) - (a._smartScore ?? 0));
  }, [posts, searchQuery, likeCounts]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Academic Help': return 'bg-category-academic';
      case 'Tutoring': return 'bg-category-tutoring';
      case 'Buy & Sell': return 'bg-category-marketplace';
      default: return 'bg-primary';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Academic Help': return <BookOpen className="h-3.5 w-3.5" />;
      case 'Tutoring': return <GraduationCap className="h-3.5 w-3.5" />;
      case 'Buy & Sell': return <ShoppingBag className="h-3.5 w-3.5" />;
      default: return <Sparkles className="h-3.5 w-3.5" />;
    }
  };

  const getActionButton = (category: string) => {
    switch (category) {
      case 'Academic Help': return { text: 'I Can Help', icon: <MessageSquare className="h-4 w-4" /> };
      case 'Tutoring': return { text: 'Book Session', icon: <GraduationCap className="h-4 w-4" /> };
      case 'Buy & Sell': return { text: 'Make Offer', icon: <ShoppingBag className="h-4 w-4" /> };
      default: return { text: 'Respond', icon: <MessageCircle className="h-4 w-4" /> };
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background/50 flex flex-col">
      <Navbar />

      {hasNewPosts && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-top">
          <Button
            onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setHasNewPosts(false); fetchPosts(); }}
            className="shadow-lg rounded-full bg-primary hover:bg-primary/90"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> New posts available
          </Button>
        </div>
      )}

      <div className="flex-1 flex justify-center w-full max-w-[1440px] mx-auto px-4 py-6 md:py-8 gap-8 pb-32 md:pb-8">
        <div className="flex flex-col lg:flex-row gap-8 justify-center">
          {/* Left Sidebar - Navigation */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24 space-y-6">
              <div className="space-y-2">
                <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Navigation</h3>
                <Button
                  variant={filter === 'all' ? 'default' : 'ghost'}
                  className={`w-full justify-start gap-3 h-11 rounded-3xl ${filter === 'all' ? 'shadow-lg shadow-primary/20' : 'hover:bg-primary/5'}`}
                  onClick={() => setFilter('all')}
                >
                  <Sparkles className={`h-5 w-5 ${filter === 'all' ? '' : 'text-primary'}`} />
                  <span className="font-medium">Discovery</span>
                </Button>
                <Button
                  variant={filter === 'Academic Help' ? 'default' : 'ghost'}
                  className={`w-full justify-start gap-3 h-11 rounded-3xl ${filter === 'Academic Help' ? 'shadow-lg shadow-category-academic/20' : 'hover:bg-primary/5'}`}
                  onClick={() => setFilter('Academic Help')}
                >
                  <BookOpen className={`h-5 w-5 ${filter === 'Academic Help' ? '' : 'text-category-academic'}`} />
                  <span className="font-medium">Academic Help</span>
                </Button>
                <Button
                  variant={filter === 'Tutoring' ? 'default' : 'ghost'}
                  className={`w-full justify-start gap-3 h-11 rounded-3xl ${filter === 'Tutoring' ? 'shadow-lg shadow-category-tutoring/20' : 'hover:bg-primary/5'}`}
                  onClick={() => setFilter('Tutoring')}
                >
                  <GraduationCap className={`h-5 w-5 ${filter === 'Tutoring' ? '' : 'text-category-tutoring'}`} />
                  <span className="font-medium">Tutoring</span>
                </Button>
                <Button
                  variant={filter === 'Buy & Sell' ? 'default' : 'ghost'}
                  className={`w-full justify-start gap-3 h-11 rounded-3xl ${filter === 'Buy & Sell' ? 'shadow-lg shadow-category-marketplace/20' : 'hover:bg-primary/5'}`}
                  onClick={() => setFilter('Buy & Sell')}
                >
                  <ShoppingBag className={`h-5 w-5 ${filter === 'Buy & Sell' ? '' : 'text-category-marketplace'}`} />
                  <span className="font-medium">Marketplace</span>
                </Button>
              </div>

              <Button className="w-full h-12 font-semibold rounded-3xl bg-gradient-primary shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform" asChild>
                <Link to="/create-post">
                  <Plus className="h-5 w-5 mr-2" /> Create Post
                </Link>
              </Button>
            </div>
          </aside>

          {/* Main Feed - Centralized */}
          <main className="w-full max-w-2xl">
            {/* Search Bar - Glassified */}
            <div className="glass-panel p-2 mb-6 border-white/20">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search campus opportunities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-transparent border-none focus-visible:ring-0 text-base"
                />
              </div>
            </div>

            {/* Posts */}
            {isLoading ? (
              <FeedSkeleton />
            ) : (
              <div className="space-y-6">
                {filteredPosts.map((post) => {
                  const actionBtn = getActionButton(post.category);
                  return (
                    <Card
                      key={post.id}
                      className="glass-panel border-white/20 overflow-hidden cursor-pointer group transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 active:scale-[0.995] flex flex-col h-full"
                      onClick={() => navigate(`/post/${post.id}`)}
                    >
                      <div className="p-5 flex flex-col h-full">
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-4">
                          <Avatar className="h-11 w-11 ring-2 ring-primary/10 transition-transform group-hover:scale-105">
                            <AvatarImage src={post.profiles.profile_picture || ""} alt={post.profiles.name} />
                            <AvatarFallback className="bg-primary/5 text-primary font-bold">
                              {post.profiles.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-base truncate hover:underline">{post.profiles.name}</span>
                              <Badge
                                variant="secondary"
                                className={`${getCategoryColor(post.category)}/10 text-${getCategoryColor(post.category).replace('bg-', '')} border-none text-[10px] font-bold px-2 py-0.5 rounded-full`}
                              >
                                {post.category.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <span>{formatTimestamp(post.created_at)}</span>
                              {post.profiles.rating > 0 && (
                                <>
                                  <span>•</span>
                                  <div className="flex items-center gap-0.5">
                                    <span className="text-accent text-[10px]">★</span>
                                    <span className="font-medium text-foreground/80">{post.profiles.rating.toFixed(1)}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/5">
                                <MoreHorizontal className="h-5 w-5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="glass-panel border-white/20 w-48">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); copyToClipboard(`${window.location.origin}/post/${post.id}`); }} className="rounded-xl">
                                <Copy className="mr-2 h-4 w-4" /> Copy link
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="rounded-xl">
                                <Bookmark className="mr-2 h-4 w-4" /> Save post
                              </DropdownMenuItem>
                              {post.user_id === user?.id && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/edit-post/${post.id}`); }} className="rounded-xl">
                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => handleDeletePost(post.id, e)} className="text-destructive rounded-xl">
                                    <Trash className="mr-2 h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Content */}
                        <div className="mb-4 space-y-2">
                          <h3 className="text-xl font-bold leading-tight tracking-tight group-hover:text-primary transition-colors">
                            {post.title}
                          </h3>
                          <p className="text-[15px] text-muted-foreground leading-relaxed line-clamp-3">
                            {post.description}
                          </p>
                          {post.ai_summary && (
                            <div className="mt-2 text-xs text-primary/80 italic flex items-center gap-1.5 bg-primary/5 px-2 py-1 rounded-lg w-fit">
                              <Sparkles className="h-3 w-3" />
                              <span className="truncate max-w-[250px]">{post.ai_summary}</span>
                            </div>
                          )}
                        </div>

                        {/* Campus Highlight */}
                        {post.campus_highlight && (
                          <div className="mb-4 px-3 py-2 bg-primary/5 rounded-3xl border border-primary/10 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary shrink-0" />
                            <p className="text-xs font-medium text-primary-foreground/90">{post.campus_highlight}</p>
                          </div>
                        )}

                        {/* Image */}
                        {post.image_url && (
                          <div className="mb-4 rounded-3xl overflow-hidden border border-white/10 shadow-inner">
                            <img
                              src={post.image_url}
                              alt={post.title}
                              className="w-full max-h-[400px] object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          </div>
                        )}

                        {/* Price & Tags */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex flex-wrap gap-2">
                            {post.optional_price && (
                              <Badge className="bg-primary/10 text-primary border-none font-bold px-3 py-1 rounded-full text-xs">
                                ${post.optional_price.toFixed(2)}
                              </Badge>
                            )}
                            {post.tags && post.tags.slice(0, 2).map((tag, index) => (
                              <span key={index} className="text-xs font-semibold text-primary/60">#{tag}</span>
                            ))}
                          </div>
                        </div>

                        {/* Action Layer */}
                        <div className="flex items-center justify-between pt-4 border-t border-white/10">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-9 px-3 gap-2 rounded-full transition-all ${likedPosts.has(post.id) ? 'bg-red-500/10 text-red-500' : 'hover:bg-red-500/5 hover:text-red-500'}`}
                              onClick={(e) => toggleLike(post.id, e)}
                            >
                              <Heart className={`h-5 w-5 ${likedPosts.has(post.id) ? 'fill-current' : ''}`} />
                              <span className="font-bold text-sm">{likeCounts[post.id] || 0}</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 px-3 gap-2 rounded-full hover:bg-primary/5 transition-all"
                              onClick={(e) => { e.stopPropagation(); navigate(`/post/${post.id}`); }}
                            >
                              <MessageSquare className="h-5 w-5" />
                              <span className="font-bold text-sm">{post.comment_count || 0}</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 w-9 p-0 rounded-full hover:bg-primary/5 transition-all"
                              onClick={(e) => handleShare(post, e)}
                            >
                              <Share2 className="h-5 w-5" />
                            </Button>
                          </div>

                          {post.user_id !== user?.id && (
                            <Button
                              size="sm"
                              className="h-9 rounded-full px-4 gap-2 bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-500 ease-in-out hover:scale-105 active:scale-95 text-white font-bold text-xs"
                              onClick={(e) => { e.stopPropagation(); navigate(`/messages?userId=${post.user_id}`); }}
                            >
                              {actionBtn.icon}
                              <span>{actionBtn.text}</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}

                {filteredPosts.length === 0 && !isLoading && searchQuery && (
                  <Card className="p-6 text-center">
                    <Search className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">No posts matching "{searchQuery}"</p>
                  </Card>
                )}
              </div>
            )}

            {!isLoading && posts.length === 0 && (
              <Card className="p-8 text-center">
                <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground mb-3">No posts yet. Be the first to create one!</p>
                <Button asChild size="sm">
                  <Link to="/create-post"><Plus className="h-3.5 w-3.5 mr-1.5" /> Create Post</Link>
                </Button>
              </Card>
            )}
          </main>

          {/* Right Sidebar - Impulse & Helpers */}
          <aside className="hidden xl:block w-72 flex-shrink-0">
            <div className="sticky top-24 space-y-6">
              {/* Campus Pulse - Real Data */}
              <div className="glass-panel p-5 border-white/20">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-1.5 bg-accent/10 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-accent" />
                  </div>
                  <h3 className="font-display font-extrabold text-sm tracking-tight uppercase">Campus Pulse</h3>
                </div>
                <div className="space-y-4">
                  {trendingTags.length > 0 ? (
                    trendingTags.map((item, index) => (
                      <div
                        key={item.tag}
                        className="group flex items-center justify-between cursor-pointer"
                        onClick={() => setSearchQuery(item.tag)}
                      >
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-0.5">
                            {index === 0 ? '🔥 Trending' : index === 1 ? '✨ Rising' : '📍 Popular'}
                          </p>
                          <p className="font-bold text-sm group-hover:text-primary transition-colors">#{item.tag}</p>
                        </div>
                        <span className="text-[10px] font-bold bg-primary/5 px-2 py-1 rounded-lg text-primary">{item.count}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No trending topics yet
                    </p>
                  )}
                </div>
              </div>

              {/* Top Helpers - Real Data */}
              <div className="glass-panel p-5 border-white/20">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-1.5 bg-primary/10 rounded-lg">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-display font-extrabold text-sm tracking-tight uppercase">Top Helpers</h3>
                </div>
                <div className="space-y-4">
                  {topHelpers.length > 0 ? (
                    topHelpers.map((helper) => (
                      <div
                        key={helper.id}
                        className="flex items-center gap-3 group cursor-pointer"
                        onClick={() => navigate(`/messages?userId=${helper.id}`)}
                      >
                        <Avatar className="h-9 w-9 ring-2 ring-primary/5 group-hover:scale-105 transition-transform">
                          <AvatarImage src={helper.profile_picture || ""} alt={helper.name} />
                          <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                            {helper.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{helper.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-accent text-[10px]">★</span>
                            <span className="text-[10px] font-bold text-muted-foreground">{helper.rating.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No top helpers yet
                    </p>
                  )}
                </div>
                <Button variant="ghost" className="w-full mt-6 h-9 text-xs font-bold rounded-xl hover:bg-primary/5 transition-all" onClick={() => navigate('/leaderboard')}>
                  View All Helpers
                </Button>
              </div>

              <div className="px-4">
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase text-center tracking-widest">
                  © {new Date().getFullYear()} CampusLink Proprietary UI
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Bottom Navigation for Mobile */}
      <BottomNav />

      {/* AI Assistant Floating Button */}
      <AIAssistant />
    </div>
  );
};

export default Feed;
