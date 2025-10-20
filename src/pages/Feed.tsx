import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, BookOpen, Users, ShoppingCart, Star, MessageCircle, Search } from "lucide-react";
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
  profiles: {
    name: string;
    rating: number;
  };
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "Academic Help":
      return <BookOpen className="h-4 w-4" />;
    case "Tutoring":
      return <Users className="h-4 w-4" />;
    case "Buy & Sell":
      return <ShoppingCart className="h-4 w-4" />;
    default:
      return null;
  }
};

const Feed = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [user, setUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

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
          event: '*',
          schema: 'public',
          table: 'posts'
        },
        () => fetchPosts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

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
        profiles (
          name,
          rating
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
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = searchQuery === "" || 
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.profiles.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Campus Feed</h1>
            <p className="text-muted-foreground">Discover requests, tutoring, and marketplace</p>
          </div>
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search posts or users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Academic Help">Academic Help</SelectItem>
                <SelectItem value="Tutoring">Tutoring</SelectItem>
                <SelectItem value="Buy & Sell">Buy & Sell</SelectItem>
              </SelectContent>
            </Select>
            <Button asChild className="whitespace-nowrap">
              <Link to="/create-post">
                <Plus className="h-4 w-4 mr-2" />
                New Post
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPosts.map((post) => (
            <Card key={post.id} className="shadow-card hover:shadow-hover transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <Badge variant="secondary" className="gap-1">
                    {getCategoryIcon(post.category)}
                    {post.category}
                  </Badge>
                  {post.optional_price && (
                    <span className="font-bold text-primary">₦{post.optional_price.toLocaleString('en-NG')}</span>
                  )}
                </div>
                <CardTitle className="text-xl">{post.title}</CardTitle>
                
                {/* Campus Highlight */}
                {post.campus_highlight && (
                  <div className="bg-accent/10 border border-accent/30 rounded-lg px-3 py-1.5 mt-2">
                    <p className="text-xs font-medium text-accent">{post.campus_highlight}</p>
                  </div>
                )}
                
                <CardDescription className="flex items-center gap-2 text-sm mt-2">
                  <span>{post.profiles.name}</span>
                  {post.profiles.rating > 0 && (
                    <span className="flex items-center gap-1 text-amber-500">
                      <Star className="h-3 w-3 fill-current" />
                      {post.profiles.rating.toFixed(1)}
                    </span>
                  )}
                </CardDescription>
                
                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {post.tags.slice(0, 3).map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {post.ai_summary && (
                  <div className="bg-accent-light/20 border border-accent-light rounded-lg p-3">
                    <p className="text-sm text-foreground/80 italic">{post.ai_summary}</p>
                  </div>
                )}
                {post.image_url && (
                  <div className="rounded-lg overflow-hidden">
                    <img 
                      src={post.image_url} 
                      alt={post.title}
                      className="w-full h-48 object-cover"
                    />
                  </div>
                )}
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {post.description}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" asChild>
                    <Link to={`/post/${post.id}`}>View Details</Link>
                  </Button>
                  {user?.id !== post.user_id && (
                    <Button 
                      variant="default" 
                      size="icon"
                      asChild
                    >
                      <Link to={`/messages?userId=${post.user_id}`}>
                        <MessageCircle className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredPosts.length === 0 && posts.length > 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">No posts match your search.</p>
          </div>
        )}

        {posts.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">No posts yet. Be the first to create one!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Feed;
