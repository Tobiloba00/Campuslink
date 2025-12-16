import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Plus, Search, RefreshCw, MessageCircle, Heart, Share2, Eye, MoreVertical, Copy, Flag, EyeOff, Trash, Edit } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

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

type PostLike = {
  post_id: string;
  user_id: string;
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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts'
        },
        (payload) => {
          const newPost = payload.new;
          if (lastSeenPostId && newPost.id !== lastSeenPostId) {
            setHasNewPosts(true);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'posts'
        },
        () => fetchPosts()
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'posts'
        },
        () => fetchPosts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter, lastSeenPostId, user]);

  const fetchUserLikes = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', user.id);

    if (!error && data) {
      setLikedPosts(new Set(data.map(like => like.post_id)));
    }
  };

  const fetchPosts = async () => {
    let query = supabase
      .from('posts')
      .select(`
        id,
        title,
        description,
        category,
        optional_price,
        ai_summary,
        image_url,
        created_at,
        user_id,
        tags,
        campus_highlight,
        engagement_count,
        profiles (
          name,
          rating,
          profile_picture
        )
      `)
      .order('created_at', { ascending: false });

    if (filter !== "all") {
      query = query.eq('category', filter as any);
    }

    const { data, error } = await query;

    if (error) {
      toast.error("Failed to load posts");
      return;
    }

    setPosts(data || []);
    
    // Fetch like counts for all posts
    if (data && data.length > 0) {
      const postIds = data.map(p => p.id);
      const { data: likesData } = await supabase
        .from('post_likes')
        .select('post_id')
        .in('post_id', postIds);

      if (likesData) {
        const counts: Record<string, number> = {};
        likesData.forEach(like => {
          counts[like.post_id] = (counts[like.post_id] || 0) + 1;
        });
        setLikeCounts(counts);
      }

      const topPostId = data[0].id;
      setLastSeenPostId(topPostId);
      
      const seenPosts = JSON.parse(localStorage.getItem('seenPosts') || '[]');
      if (!seenPosts.includes(topPostId)) {
        seenPosts.push(topPostId);
        if (seenPosts.length > 100) seenPosts.shift();
        localStorage.setItem('seenPosts', JSON.stringify(seenPosts));
      }
    }
  };

  const toggleLike = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Please login to like posts");
      return;
    }

    const isLiked = likedPosts.has(postId);

    // Optimistic update
    setLikedPosts(prev => {
      const newSet = new Set(prev);
      if (isLiked) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });

    setLikeCounts(prev => ({
      ...prev,
      [postId]: (prev[postId] || 0) + (isLiked ? -1 : 1)
    }));

    try {
      if (isLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: user.id });
      }
    } catch (error) {
      // Revert on error
      setLikedPosts(prev => {
        const newSet = new Set(prev);
        if (isLiked) {
          newSet.add(postId);
        } else {
          newSet.delete(postId);
        }
        return newSet;
      });
      setLikeCounts(prev => ({
        ...prev,
        [postId]: (prev[postId] || 0) + (isLiked ? 1 : -1)
      }));
      toast.error("Failed to update like");
    }
  };

  const handleShare = async (post: Post, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/post/${post.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: post.description.substring(0, 100),
          url: url
        });
      } catch (err) {
        // User cancelled or error
        await copyToClipboard(url);
      }
    } else {
      await copyToClipboard(url);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copied to clipboard!");
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const handleCopyLink = (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/post/${postId}`;
    copyToClipboard(url);
  };

  const handleDeletePost = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this post?")) return;

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', user.id);

    if (error) {
      toast.error("Failed to delete post");
    } else {
      toast.success("Post deleted");
      fetchPosts();
    }
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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {hasNewPosts && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-top">
          <Button
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setHasNewPosts(false);
              fetchPosts();
            }}
            className="shadow-lg rounded-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            New posts available
          </Button>
        </div>
      )}
      
      {/* Twitter/X Style Layout */}
      <div className="flex justify-center">
        {/* Left Sidebar - Hidden on mobile/tablet */}
        <aside className="hidden lg:block w-64 xl:w-72 sticky top-16 h-[calc(100vh-4rem)] border-r border-border p-4">
          <nav className="space-y-2">
            <Button variant="ghost" className="w-full justify-start gap-3 text-base font-medium" onClick={() => navigate('/feed')}>
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M22.46 6c-.85.38-1.78.64-2.75.76 1-.6 1.76-1.55 2.12-2.68-.93.55-1.96.95-3.06 1.17-.88-.94-2.13-1.53-3.51-1.53-2.66 0-4.81 2.16-4.81 4.81 0 .38.04.75.13 1.1-4-.2-7.58-2.11-9.96-5.02-.42.72-.66 1.56-.66 2.46 0 1.68.85 3.16 2.14 4.02-.79-.02-1.53-.24-2.18-.6v.06c0 2.35 1.67 4.31 3.88 4.76-.4.1-.83.16-1.27.16-.31 0-.62-.03-.92-.08.63 1.96 2.45 3.39 4.61 3.43-1.69 1.32-3.83 2.1-6.15 2.1-.4 0-.8-.02-1.19-.07 2.19 1.4 4.78 2.22 7.57 2.22 9.07 0 14.02-7.52 14.02-14.02 0-.21 0-.43-.01-.64.96-.69 1.79-1.56 2.45-2.55z"/></svg>
              Home
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-base" onClick={() => navigate('/user-search')}>
              <Search className="h-6 w-6" />
              Explore
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-base" onClick={() => navigate('/messages')}>
              <MessageCircle className="h-6 w-6" />
              Messages
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-base" onClick={() => navigate('/profile')}>
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">Me</AvatarFallback>
              </Avatar>
              Profile
            </Button>
            <Button className="w-full rounded-full mt-4" asChild>
              <Link to="/create-post">
                <Plus className="h-5 w-5 mr-2" />
                Post
              </Link>
            </Button>
          </nav>
        </aside>

        {/* Main Feed */}
        <main className="flex-1 max-w-xl lg:max-w-2xl border-x border-border min-h-screen">
          {/* Header Section */}
          <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-md border-b border-border">
            <div className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-lg sm:text-xl font-bold">Campus Feed</h1>
                <Button asChild size="sm" className="rounded-full lg:hidden">
                  <Link to="/create-post">
                    <Plus className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Post</span>
                  </Link>
                </Button>
              </div>

              {/* Search and Filter Row */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search posts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 rounded-full h-9 sm:h-10 text-sm"
                  />
                </div>
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-24 sm:w-32 rounded-full h-9 sm:h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Academic Help">Academic</SelectItem>
                    <SelectItem value="Tutoring">Tutoring</SelectItem>
                    <SelectItem value="Buy & Sell">Buy & Sell</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Posts Feed */}
          <div className="divide-y divide-border">
            {filteredPosts.map((post) => (
              <article 
                key={post.id} 
                className="hover:bg-accent/5 transition-colors cursor-pointer"
                onClick={() => navigate(`/post/${post.id}`)}
              >
                {/* Post Header with Price */}
                <div className="p-3 sm:p-4 pb-0">
                  <div className="flex gap-3">
                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
                      <AvatarImage src={post.profiles.profile_picture || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {post.profiles.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
                          <span className="font-bold text-sm sm:text-[15px] truncate max-w-[120px] sm:max-w-none">{post.profiles.name}</span>
                          {post.profiles.rating > 0 && (
                            <span className="text-xs text-amber-500 flex-shrink-0">⭐{post.profiles.rating.toFixed(1)}</span>
                          )}
                          <span className="text-muted-foreground text-sm hidden sm:inline">·</span>
                          <span className="text-muted-foreground text-xs sm:text-sm">{formatTimestamp(post.created_at)}</span>
                          <span className="text-muted-foreground text-sm hidden sm:inline">·</span>
                          <span className="text-xs text-primary font-medium">{post.category}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Price Badge - Moved to top */}
                          {post.optional_price && (
                            <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-xs sm:text-sm font-bold">
                              ₦{post.optional_price.toLocaleString('en-NG')}
                            </span>
                          )}
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={(e) => handleCopyLink(post.id, e as any)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Copy link
                              </DropdownMenuItem>
                              {user?.id === post.user_id ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/edit-post/${post.id}`);
                                  }}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit post
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={(e) => handleDeletePost(post.id, e as any)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash className="h-4 w-4 mr-2" />
                                    Delete post
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    toast.info("Post hidden from your feed");
                                  }}>
                                    <EyeOff className="h-4 w-4 mr-2" />
                                    Not interested
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    toast.info("Thanks for reporting. We'll review this post.");
                                  }}>
                                    <Flag className="h-4 w-4 mr-2" />
                                    Report post
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Post Content */}
                <div className="px-3 sm:px-4 pl-[52px] sm:pl-[68px] pb-3">
                  <h2 className="font-semibold text-sm sm:text-[15px] mb-1 leading-snug">{post.title}</h2>
                  <p className="text-sm text-foreground/90 leading-relaxed mb-2 line-clamp-3">
                    {post.description}
                  </p>

                  {/* Tags */}
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {post.tags.slice(0, 4).map((tag, idx) => (
                        <span key={idx} className="text-xs text-primary hover:underline cursor-pointer">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Campus Highlight */}
                  {post.campus_highlight && (
                    <div className="bg-accent/20 border border-accent/40 rounded-lg px-3 py-1.5 mb-2 inline-block">
                      <p className="text-xs font-medium text-accent-foreground">{post.campus_highlight}</p>
                    </div>
                  )}

                  {/* Image */}
                  {post.image_url && (
                    <div className="rounded-2xl overflow-hidden border border-border mt-2 max-w-md">
                      <img 
                        src={post.image_url} 
                        alt={post.title}
                        className="w-full max-h-80 object-cover"
                      />
                    </div>
                  )}

                  {/* Engagement Bar */}
                  <div className="flex items-center justify-between mt-3 -ml-2 max-w-md">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="hover:text-primary hover:bg-primary/10 rounded-full gap-1.5 h-9 px-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/post/${post.id}#comments`);
                      }}
                    >
                      <MessageCircle className="h-[18px] w-[18px]" />
                      <span className="text-xs">Comment</span>
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`hover:text-rose-500 hover:bg-rose-500/10 rounded-full gap-1.5 h-9 px-3 ${
                        likedPosts.has(post.id) ? 'text-rose-500' : ''
                      }`}
                      onClick={(e) => toggleLike(post.id, e)}
                    >
                      <Heart className={`h-[18px] w-[18px] ${likedPosts.has(post.id) ? 'fill-current' : ''}`} />
                      <span className="text-xs">{likeCounts[post.id] || ''}</span>
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="hover:text-green-500 hover:bg-green-500/10 rounded-full gap-1.5 h-9 px-3"
                      onClick={(e) => handleShare(post, e)}
                    >
                      <Share2 className="h-[18px] w-[18px]" />
                      <span className="text-xs hidden sm:inline">Share</span>
                    </Button>

                    {post.engagement_count > 0 && (
                      <div className="flex items-center gap-1 text-muted-foreground px-3">
                        <Eye className="h-4 w-4" />
                        <span className="text-xs">{post.engagement_count}</span>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>

          {filteredPosts.length === 0 && posts.length > 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No posts match your search.</p>
            </div>
          )}

          {posts.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No posts yet. Be the first to create one!</p>
            </div>
          )}
        </main>

        {/* Right Sidebar - Hidden on mobile/tablet */}
        <aside className="hidden xl:block w-80 sticky top-16 h-[calc(100vh-4rem)] p-4">
          <div className="bg-muted/30 rounded-2xl p-4">
            <h2 className="font-bold text-lg mb-4">Trending on Campus</h2>
            <div className="space-y-3 text-sm">
              <div className="hover:bg-muted/50 rounded-lg p-2 cursor-pointer transition-colors">
                <p className="text-muted-foreground text-xs">Academic · Trending</p>
                <p className="font-semibold">#Exams2024</p>
                <p className="text-muted-foreground text-xs">1.2K posts</p>
              </div>
              <div className="hover:bg-muted/50 rounded-lg p-2 cursor-pointer transition-colors">
                <p className="text-muted-foreground text-xs">Buy & Sell · Trending</p>
                <p className="font-semibold">#UsedTextbooks</p>
                <p className="text-muted-foreground text-xs">856 posts</p>
              </div>
              <div className="hover:bg-muted/50 rounded-lg p-2 cursor-pointer transition-colors">
                <p className="text-muted-foreground text-xs">Tutoring · Trending</p>
                <p className="font-semibold">#MathHelp</p>
                <p className="text-muted-foreground text-xs">432 posts</p>
              </div>
            </div>
          </div>
          
          <div className="mt-4 text-xs text-muted-foreground">
            <p>© 2024 CampusLink · <Link to="/terms" className="hover:underline">Terms</Link> · <Link to="/privacy" className="hover:underline">Privacy</Link></p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Feed;