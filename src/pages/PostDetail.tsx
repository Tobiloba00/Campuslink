import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BookOpen, Users, ShoppingCart, Star, MessageCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type Post = {
  id: string;
  title: string;
  description: string;
  category: string;
  optional_price: number | null;
  ai_summary: string | null;
  created_at: string;
  user_id: string;
  profiles: {
    name: string;
    rating: number;
    email: string;
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

const PostDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });
  }, [navigate]);

  useEffect(() => {
    fetchPost();
  }, [id]);

  const fetchPost = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        title,
        description,
        category,
        optional_price,
        ai_summary,
        created_at,
        user_id,
        profiles (
          name,
          rating,
          email
        )
      `)
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

  const handleSendMessage = () => {
    if (!post) return;
    navigate(`/messages?userId=${post.user_id}`);
  };

  if (loading || !post || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/feed")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Feed
        </Button>

        <Card className="shadow-card">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    {post.profiles.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{post.profiles.name}</p>
                  {post.profiles.rating > 0 && (
                    <div className="flex items-center gap-1 text-sm text-amber-500">
                      <Star className="h-3 w-3 fill-current" />
                      {post.profiles.rating.toFixed(1)}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary" className="gap-1">
                  {getCategoryIcon(post.category)}
                  {post.category}
                </Badge>
                {post.optional_price && (
                  <Badge variant="outline" className="text-primary font-bold">
                    ${post.optional_price}
                  </Badge>
                )}
              </div>
            </div>
            
            <CardTitle className="text-3xl">{post.title}</CardTitle>
            <CardDescription>
              Posted {new Date(post.created_at).toLocaleDateString()}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {post.ai_summary && (
              <div className="bg-accent-light/20 border border-accent-light rounded-lg p-4">
                <p className="text-sm font-semibold mb-1 text-foreground">AI Summary</p>
                <p className="text-sm text-foreground/80 italic">{post.ai_summary}</p>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{post.description}</p>
            </div>

            {user.id !== post.user_id && (
              <Button 
                onClick={handleSendMessage} 
                className="w-full md:w-auto"
                size="lg"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Send Message
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PostDetail;
