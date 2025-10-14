import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookOpen, Users, ShoppingCart, Star, MessageCircle, ArrowLeft, Edit, Trash, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Comments } from "@/components/Comments";

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
  profiles: {
    name: string;
    rating: number;
    email: string;
    profile_picture: string | null;
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
  const [isDeleting, setIsDeleting] = useState(false);

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
        image_url,
        created_at,
        user_id,
        profiles (
          name,
          rating,
          email,
          profile_picture
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

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this post? This will also delete all comments.")) {
      return;
    }

    setIsDeleting(true);
    try {
      // Delete post image if exists
      if (post?.image_url) {
        const path = post.image_url.split("/").slice(-3).join("/");
        await supabase.storage.from("post-images").remove([path]);
      }

      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) throw error;

      toast.success("Post deleted successfully");
      navigate("/feed");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = () => {
    navigate(`/edit-post/${id}`);
  };

  if (loading || !post || !user) return null;

  const isOwner = user.id === post.user_id;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-4xl">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/feed")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Feed
        </Button>

        <Card className="shadow-card mb-8">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={post.profiles.profile_picture || ""} alt={post.profiles.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg">
                    {post.profiles.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">{post.profiles.name}</p>
                  {post.profiles.rating > 0 && (
                    <div className="flex items-center gap-1 text-sm text-accent">
                      <Star className="h-3 w-3 fill-current" />
                      {post.profiles.rating.toFixed(1)}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1">
                  {getCategoryIcon(post.category)}
                  {post.category}
                </Badge>
                {post.optional_price && (
                  <Badge variant="outline" className="text-accent font-bold border-accent">
                    ${post.optional_price}
                  </Badge>
                )}
              </div>
            </div>
            
            <CardTitle className="text-2xl md:text-3xl text-foreground">{post.title}</CardTitle>
            <CardDescription className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Posted {new Date(post.created_at).toLocaleDateString()}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {post.image_url && (
              <img
                src={post.image_url}
                alt={post.title}
                className="w-full h-auto max-h-96 object-cover rounded-lg"
              />
            )}

            {post.ai_summary && (
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                <p className="text-sm font-semibold mb-1 text-foreground">AI Summary</p>
                <p className="text-sm text-foreground/80 italic">{post.ai_summary}</p>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-2 text-foreground">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{post.description}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              {!isOwner && (
                <Button 
                  onClick={handleSendMessage} 
                  className="flex-1 md:flex-none"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              )}
              
              {isOwner && (
                <>
                  <Button 
                    onClick={handleEdit}
                    variant="outline"
                    className="flex-1 md:flex-none"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Post
                  </Button>
                  <Button 
                    onClick={handleDelete}
                    variant="destructive"
                    disabled={isDeleting}
                    className="flex-1 md:flex-none"
                  >
                    <Trash className="h-4 w-4 mr-2" />
                    {isDeleting ? "Deleting..." : "Delete Post"}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Comments Section */}
        <Comments postId={id!} />
      </div>
    </div>
  );
};

export default PostDetail;
