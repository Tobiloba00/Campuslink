import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen, Users, ShoppingCart, Star } from "lucide-react";
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
  created_at: string;
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
        created_at,
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
          <div className="flex gap-4 w-full md:w-auto">
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

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Card key={post.id} className="shadow-card hover:shadow-hover transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <Badge variant="secondary" className="gap-1">
                    {getCategoryIcon(post.category)}
                    {post.category}
                  </Badge>
                  {post.optional_price && (
                    <span className="font-bold text-accent">${post.optional_price}</span>
                  )}
                </div>
                <CardTitle className="text-xl">{post.title}</CardTitle>
                <CardDescription className="flex items-center gap-2 text-sm">
                  <span>{post.profiles.name}</span>
                  {post.profiles.rating > 0 && (
                    <span className="flex items-center gap-1 text-amber-500">
                      <Star className="h-3 w-3 fill-current" />
                      {post.profiles.rating.toFixed(1)}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {post.ai_summary && (
                  <div className="bg-accent-light/20 border border-accent-light rounded-lg p-3">
                    <p className="text-sm text-foreground/80 italic">{post.ai_summary}</p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {post.description}
                </p>
                <Button variant="outline" className="w-full" asChild>
                  <Link to={`/post/${post.id}`}>View Details</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

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
