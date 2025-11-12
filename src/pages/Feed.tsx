import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Plus, Search, RefreshCw, MessageCircle, Heart, Share2, Eye, MoreVertical } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const Feed = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [user, setUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const [lastSeenPostId, setLastSeenPostId] = useState<string | null>(null);

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
    fetchPosts();

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
  }, [filter, lastSeenPostId]);

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
    
    if (data && data.length > 0) {
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
            className="shadow-lg"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            New posts available
          </Button>
        </div>
      )}
      
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header Section */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Campus Feed</h1>
            <Button asChild size="sm" className="rounded-full">
              <Link to="/create-post">
                <Plus className="h-4 w-4 mr-1" />
                Post
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
                className="pl-9 rounded-full"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[140px] rounded-full">
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

        {/* Posts Feed */}
        <div className="flex flex-col gap-3">
          {filteredPosts.map((post) => (
            <article 
              key={post.id} 
              className="bg-card border border-border rounded-xl hover:bg-accent/5 transition-colors cursor-pointer"
              onClick={() => navigate(`/post/${post.id}`)}
            >
              {/* Post Header */}
              <div className="p-4 pb-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
                    <AvatarImage src={post.profiles.profile_picture || ""} />
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 font-semibold">
                      {post.profiles.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{post.profiles.name}</span>
                      {post.profiles.rating > 0 && (
                        <span className="text-xs text-amber-500">⭐ {post.profiles.rating.toFixed(1)}</span>
                      )}
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{formatTimestamp(post.created_at)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{post.category}</div>
                  </div>

                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Post Content */}
              <div className="px-4 pb-3">
                <h2 className="font-semibold text-base mb-1.5 leading-snug">{post.title}</h2>
                <p className="text-sm text-foreground/80 line-clamp-3 leading-relaxed mb-2">
                  {post.description}
                </p>

                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {post.tags.slice(0, 3).map((tag, idx) => (
                      <span key={idx} className="text-xs text-primary hover:underline">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Campus Highlight */}
                {post.campus_highlight && (
                  <div className="bg-accent/10 border border-accent/30 rounded-lg px-3 py-1.5 mb-2 inline-block">
                    <p className="text-xs font-medium text-accent">{post.campus_highlight}</p>
                  </div>
                )}

                {/* Image */}
                {post.image_url && (
                  <div className="rounded-xl overflow-hidden border border-border mt-3">
                    <img 
                      src={post.image_url} 
                      alt={post.title}
                      className="w-full max-h-96 object-cover"
                    />
                  </div>
                )}

                {/* Price */}
                {post.optional_price && (
                  <div className="mt-3 inline-flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full">
                    <span className="text-sm font-bold">₦{post.optional_price.toLocaleString('en-NG')}</span>
                  </div>
                )}
              </div>

              {/* Engagement Bar */}
              <div className="px-4 pb-3 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between text-muted-foreground">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="hover:text-primary hover:bg-primary/10 rounded-full gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/post/${post.id}#comments`);
                    }}
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-xs">Comment</span>
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="hover:text-rose-500 hover:bg-rose-500/10 rounded-full gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Heart className="h-4 w-4" />
                    <span className="text-xs">Like</span>
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="hover:text-green-500 hover:bg-green-500/10 rounded-full gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Share2 className="h-4 w-4" />
                    <span className="text-xs">Share</span>
                  </Button>

                  {post.engagement_count > 0 && (
                    <div className="flex items-center gap-1 text-xs">
                      <Eye className="h-3.5 w-3.5" />
                      <span>{post.engagement_count}</span>
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
      </div>
    </div>
  );
};

export default Feed;
