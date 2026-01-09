import { useEffect, useState } from "react";
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
  MessageSquare, Bookmark, ChevronDown, ChevronUp
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { FeedSkeleton } from "@/components/ui/skeleton-loaders";
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
  engagement_count: number;
  profiles: {
    name: string;
    rating: number;
    profile_picture: string | null;
  };
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
  const [showTrending, setShowTrending] = useState(false);

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

  const fetchUserLikes = async () => {
    if (!user) return;
    const { data, error } = await supabase.from('post_likes').select('post_id').eq('user_id', user.id);
    if (!error && data) {
      setLikedPosts(new Set(data.map(like => like.post_id)));
    }
  };

  const fetchPosts = async () => {
    setIsLoading(true);
    let query = supabase
      .from('posts')
      .select(`id, title, description, category, optional_price, ai_summary, image_url, created_at, user_id, tags, campus_highlight, engagement_count, profiles (name, rating, profile_picture)`)
      .order('created_at', { ascending: false });

    if (filter !== "all") {
      query = query.eq('category', filter as any);
    }

    const { data, error } = await query;
    if (error) { toast.error("Failed to load posts"); setIsLoading(false); return; }

    setPosts(data || []);
    
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
  };

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

  const filteredPosts = posts.filter(post => {
    const matchesSearch = searchQuery === "" || 
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.profiles.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

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
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
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
      
      <div className="max-w-7xl mx-auto px-4 py-4 lg:py-6">
        {/* Mobile Category Pills - Horizontal Scroll */}
        <div className="lg:hidden mb-4 -mx-4 px-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              className="rounded-full whitespace-nowrap flex-shrink-0"
              onClick={() => setFilter('all')}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              All
            </Button>
            <Button
              variant={filter === 'Academic Help' ? 'default' : 'outline'}
              size="sm"
              className="rounded-full whitespace-nowrap flex-shrink-0"
              onClick={() => setFilter(filter === 'Academic Help' ? 'all' : 'Academic Help')}
            >
              <BookOpen className="h-3.5 w-3.5 mr-1.5 text-category-academic" />
              Academic
            </Button>
            <Button
              variant={filter === 'Tutoring' ? 'default' : 'outline'}
              size="sm"
              className="rounded-full whitespace-nowrap flex-shrink-0"
              onClick={() => setFilter(filter === 'Tutoring' ? 'all' : 'Tutoring')}
            >
              <GraduationCap className="h-3.5 w-3.5 mr-1.5 text-category-tutoring" />
              Tutoring
            </Button>
            <Button
              variant={filter === 'Buy & Sell' ? 'default' : 'outline'}
              size="sm"
              className="rounded-full whitespace-nowrap flex-shrink-0"
              onClick={() => setFilter(filter === 'Buy & Sell' ? 'all' : 'Buy & Sell')}
            >
              <ShoppingBag className="h-3.5 w-3.5 mr-1.5 text-category-marketplace" />
              Marketplace
            </Button>
          </div>
        </div>

        {/* Mobile Trending Bar - Collapsible */}
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setShowTrending(!showTrending)}
            className="w-full flex items-center justify-between p-3 bg-accent/10 rounded-xl"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              <span className="font-medium text-sm">Campus Pulse</span>
              <Badge variant="secondary" className="text-[10px]">3 trending</Badge>
            </div>
            {showTrending ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          
          {showTrending && (
            <Card className="mt-2 p-3 animate-in slide-in-from-top-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                  <div>
                    <p className="text-xs text-muted-foreground">Trending</p>
                    <p className="font-semibold text-sm">#FinalExams</p>
                  </div>
                  <span className="text-xs text-muted-foreground">1.2K</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                  <div>
                    <p className="text-xs text-muted-foreground">Hot</p>
                    <p className="font-semibold text-sm">#TextbookDeals</p>
                  </div>
                  <span className="text-xs text-muted-foreground">856</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                  <div>
                    <p className="text-xs text-muted-foreground">Popular</p>
                    <p className="font-semibold text-sm">#MathHelp</p>
                  </div>
                  <span className="text-xs text-muted-foreground">432</span>
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] xl:grid-cols-[300px_1fr_300px] gap-6">
          {/* Left Sidebar - Desktop Only */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-4">
              {/* Quick Nav */}
              <Card className="p-3">
                <nav className="space-y-0.5">
                  <Button variant="ghost" className="w-full justify-start gap-2.5 h-9 font-medium" onClick={() => navigate('/feed')}>
                    <div className="h-7 w-7 rounded bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </div>
                    Feed
                  </Button>
                  <Button variant="ghost" className="w-full justify-start gap-2.5 h-9" onClick={() => navigate('/user-search')}>
                    <div className="h-7 w-7 rounded bg-muted flex items-center justify-center">
                      <Search className="h-3.5 w-3.5" />
                    </div>
                    Discover
                  </Button>
                  <Button variant="ghost" className="w-full justify-start gap-2.5 h-9" onClick={() => navigate('/messages')}>
                    <div className="h-7 w-7 rounded bg-muted flex items-center justify-center">
                      <MessageCircle className="h-3.5 w-3.5" />
                    </div>
                    Messages
                  </Button>
                  <Button variant="ghost" className="w-full justify-start gap-2.5 h-9" onClick={() => navigate('/leaderboard')}>
                    <div className="h-7 w-7 rounded bg-muted flex items-center justify-center">
                      <TrendingUp className="h-3.5 w-3.5" />
                    </div>
                    Leaderboard
                  </Button>
                  <Button variant="ghost" className="w-full justify-start gap-2.5 h-9" onClick={() => navigate('/profile')}>
                    <div className="h-7 w-7 rounded bg-muted flex items-center justify-center">
                      <Users className="h-3.5 w-3.5" />
                    </div>
                    Profile
                  </Button>
                </nav>
              </Card>

              {/* Create Post CTA */}
              <Button className="w-full h-9 font-medium" asChild>
                <Link to="/create-post">
                  <Plus className="h-4 w-4 mr-1.5" /> Create Post
                </Link>
              </Button>

              {/* Category Quick Filters */}
              <Card className="p-3">
                <h3 className="font-medium text-xs mb-2 text-muted-foreground uppercase tracking-wide">Categories</h3>
                <div className="space-y-0.5">
                  <Button 
                    variant={filter === 'Academic Help' ? 'default' : 'ghost'} 
                    className="w-full justify-start gap-2 h-8 text-sm"
                    onClick={() => setFilter(filter === 'Academic Help' ? 'all' : 'Academic Help')}
                  >
                    <BookOpen className="h-3.5 w-3.5 text-category-academic" />
                    Academic Help
                  </Button>
                  <Button 
                    variant={filter === 'Tutoring' ? 'default' : 'ghost'} 
                    className="w-full justify-start gap-2 h-8 text-sm"
                    onClick={() => setFilter(filter === 'Tutoring' ? 'all' : 'Tutoring')}
                  >
                    <GraduationCap className="h-3.5 w-3.5 text-category-tutoring" />
                    Tutoring
                  </Button>
                  <Button 
                    variant={filter === 'Buy & Sell' ? 'default' : 'ghost'} 
                    className="w-full justify-start gap-2 h-8 text-sm"
                    onClick={() => setFilter(filter === 'Buy & Sell' ? 'all' : 'Buy & Sell')}
                  >
                    <ShoppingBag className="h-3.5 w-3.5 text-category-marketplace" />
                    Buy & Sell
                  </Button>
                </div>
              </Card>
            </div>
          </aside>

          {/* Main Feed */}
          <main className="min-w-0">
            {/* Search Bar */}
            <Card className="p-2.5 mb-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search posts, users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8"
                  />
                </div>
                <div className="hidden sm:block">
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-28 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Posts</SelectItem>
                      <SelectItem value="Academic Help">Academic</SelectItem>
                      <SelectItem value="Tutoring">Tutoring</SelectItem>
                      <SelectItem value="Buy & Sell">Marketplace</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Posts */}
            {isLoading ? (
              <FeedSkeleton />
            ) : (
              <div className="space-y-3">
                {filteredPosts.map((post) => {
                  const actionBtn = getActionButton(post.category);
                  return (
                    <Card 
                      key={post.id} 
                      className="overflow-hidden cursor-pointer group hover-lift"
                      onClick={() => navigate(`/post/${post.id}`)}
                    >
                      {/* Category Accent Strip */}
                      <div className={`h-0.5 ${getCategoryColor(post.category)}`} />
                      
                      <div className="p-3">
                        {/* Header Row */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={post.profiles.profile_picture || ""} />
                              <AvatarFallback className="bg-muted text-xs font-medium">
                                {post.profiles.name?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-sm">{post.profiles.name}</span>
                                {post.profiles.rating > 0 && (
                                  <span className="text-[11px] text-amber-500">⭐{post.profiles.rating.toFixed(1)}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span>{formatTimestamp(post.created_at)}</span>
                                <span>·</span>
                                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] gap-0.5">
                                  {getCategoryIcon(post.category)}
                                  <span className="hidden sm:inline">{post.category}</span>
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {post.optional_price && (
                              <Badge className="bg-accent text-accent-foreground font-medium text-[11px] px-2">
                                ₦{post.optional_price.toLocaleString('en-NG')}
                              </Badge>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); copyToClipboard(`${window.location.origin}/post/${post.id}`); }}>
                                  <Copy className="h-4 w-4 mr-2" /> Copy link
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info("Saved to bookmarks"); }}>
                                  <Bookmark className="h-4 w-4 mr-2" /> Save post
                                </DropdownMenuItem>
                                {user?.id === post.user_id ? (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/edit-post/${post.id}`); }}>
                                      <Edit className="h-4 w-4 mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => handleDeletePost(post.id, e as any)} className="text-destructive focus:text-destructive">
                                      <Trash className="h-4 w-4 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  </>
                                ) : (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info("Post hidden"); }}>
                                      <EyeOff className="h-4 w-4 mr-2" /> Hide
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info("Thanks for reporting"); }}>
                                      <Flag className="h-4 w-4 mr-2" /> Report
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="mb-2">
                          <h2 className="font-display font-semibold text-[15px] mb-0.5 line-clamp-2">{post.title}</h2>
                          <p className="text-sm text-muted-foreground line-clamp-2">{post.description}</p>
                        </div>

                        {/* Tags */}
                        {post.tags && post.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {post.tags.slice(0, 4).map((tag, idx) => (
                              <span key={idx} className="text-[11px] text-primary font-medium hover:underline cursor-pointer">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Campus Highlight */}
                        {post.campus_highlight && (
                          <div className="bg-accent/5 border border-accent/20 rounded px-2.5 py-1.5 mb-2">
                            <p className="text-[11px] font-medium flex items-center gap-1.5">
                              <Sparkles className="h-3 w-3 text-accent" />
                              {post.campus_highlight}
                            </p>
                          </div>
                        )}

                        {/* Image */}
                        {post.image_url && (
                          <div className="rounded overflow-hidden border border-border/60 mb-2">
                            <img 
                              src={post.image_url} 
                              alt={post.title}
                              className="w-full max-h-72 object-cover"
                            />
                          </div>
                        )}

                        {/* Action Bar */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/40">
                          <div className="flex items-center gap-0.5">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 px-2 hover:bg-primary/5 hover:text-primary gap-1"
                              onClick={(e) => { e.stopPropagation(); navigate(`/post/${post.id}#comments`); }}
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span className="text-[11px] hidden sm:inline">Comment</span>
                            </Button>
                            
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className={`h-7 px-2 gap-1 ${
                                likedPosts.has(post.id) 
                                  ? 'text-rose-500 hover:bg-rose-500/5' 
                                  : 'hover:bg-rose-500/5 hover:text-rose-500'
                              }`}
                              onClick={(e) => toggleLike(post.id, e)}
                            >
                              <Heart className={`h-3.5 w-3.5 transition-transform ${likedPosts.has(post.id) ? 'fill-current scale-105' : ''}`} />
                              {likeCounts[post.id] > 0 && <span className="text-[11px]">{likeCounts[post.id]}</span>}
                            </Button>
                            
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 px-2 hover:bg-green-500/5 hover:text-green-600"
                              onClick={(e) => handleShare(post, e)}
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          {/* Context-Aware Action Button */}
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-7 text-[11px] border-primary/20 hover:bg-primary hover:text-primary-foreground hover:border-primary gap-1"
                            onClick={(e) => { e.stopPropagation(); navigate(`/messages?userId=${post.user_id}`); }}
                          >
                            {actionBtn.icon}
                            <span className="hidden sm:inline">{actionBtn.text}</span>
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {!isLoading && filteredPosts.length === 0 && posts.length > 0 && (
              <Card className="p-8 text-center">
                <Search className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No posts match your search.</p>
              </Card>
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

          {/* Right Sidebar - Desktop Only */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-4">
              {/* Campus Pulse */}
              <Card className="p-3">
                <div className="flex items-center gap-1.5 mb-3">
                  <TrendingUp className="h-4 w-4 text-accent" />
                  <h3 className="font-display font-semibold text-sm">Campus Pulse</h3>
                </div>
                <div className="space-y-1">
                  <div className="p-2 rounded hover:bg-muted/30 cursor-pointer transition-colors duration-200">
                    <p className="text-[10px] text-muted-foreground">Trending in Academic</p>
                    <p className="font-medium text-sm">#FinalExams</p>
                    <p className="text-[10px] text-muted-foreground">1.2K discussions</p>
                  </div>
                  <div className="p-2 rounded hover:bg-muted/30 cursor-pointer transition-colors duration-200">
                    <p className="text-[10px] text-muted-foreground">Hot in Marketplace</p>
                    <p className="font-medium text-sm">#TextbookDeals</p>
                    <p className="text-[10px] text-muted-foreground">856 posts</p>
                  </div>
                  <div className="p-2 rounded hover:bg-muted/30 cursor-pointer transition-colors duration-200">
                    <p className="text-[10px] text-muted-foreground">Popular Tutoring</p>
                    <p className="font-medium text-sm">#MathHelp</p>
                    <p className="text-[10px] text-muted-foreground">432 requests</p>
                  </div>
                </div>
              </Card>

              {/* Top Helpers */}
              <Card className="p-3">
                <div className="flex items-center gap-1.5 mb-3">
                  <Users className="h-4 w-4 text-primary" />
                  <h3 className="font-display font-semibold text-sm">Top Helpers</h3>
                </div>
                <div className="space-y-1">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-2.5 p-1.5 rounded hover:bg-muted/30 cursor-pointer transition-colors duration-200">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-muted text-xs font-medium">
                          {String.fromCharCode(64 + i)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">Helper {i}</p>
                        <p className="text-[10px] text-muted-foreground">⭐ 4.{9 - i} rating</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" className="w-full mt-2 h-7 text-xs" onClick={() => navigate('/leaderboard')}>
                  View Leaderboard
                </Button>
              </Card>

              <p className="text-xs text-muted-foreground text-center">
                © {new Date().getFullYear()} CampusLink
              </p>
            </div>
          </aside>
        </div>
      </div>
      
      {/* Bottom Navigation for Mobile */}
      <BottomNav />
    </div>
  );
};

export default Feed;
