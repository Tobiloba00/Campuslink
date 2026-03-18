import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookOpen, Users, ShoppingCart, Star, MessageCircle, ArrowLeft, Edit, Trash, Calendar, Tag } from "lucide-react";
import { toast } from "sonner";
import { Comments } from "@/components/Comments";
import { ExpandedPostView } from "@/components/ExpandedPostView";

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
  view_count: number;
  likes_count: number;
  reposts_count: number;
  bookmarks_count: number;
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
    if (id) {
      (supabase.rpc as any)('increment_post_view_count', { pid: id })
        .then(({ error }: any) => {
          if (error) console.error("Error incrementing post view count:", error);
        });
    }
  }, [id]);

  const fetchPost = async () => {
    if (!id) return;

    const { data, error } = await (supabase
      .from('posts') as any)
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
        view_count,
        likes_count,
        reposts_count,
        bookmarks_count,
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
    navigate(`/messages?userId=${post.user_id}&postId=${post.id}`);
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

  const handleRateUser = () => {
    if (post?.user_id) {
      navigate(`/rate-user/${post.user_id}`);
    }
  };

  if (loading || !post || !user) return null;

  const isOwner = user.id === post.user_id;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-4xl pt-20 pb-24">
        <Button
          variant="ghost"
          onClick={() => navigate("/feed")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Feed
        </Button>

        <ExpandedPostView
          post={post}
          isOwner={isOwner}
          onReply={() => document.getElementById('comment-input')?.focus()}
          onLike={() => {}}
          onRepost={() => {}}
          onBookmark={() => {}}
          onShare={() => {
            navigator.clipboard.writeText(window.location.href);
            toast.success("Link copied to clipboard");
          }}
        />

        {/* Comments Section */}
        <Comments postId={id!} postTitle={post?.title} postDescription={post?.description} />
      </div>
    </div>
  );
};

export default PostDetail;
