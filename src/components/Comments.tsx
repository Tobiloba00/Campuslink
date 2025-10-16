import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { MessageSquare, Image as ImageIcon, Loader2, Edit, Trash } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ImageUpload } from "./ImageUpload";
import { uploadImage, deleteImage } from "@/lib/imageUpload";

interface Comment {
  id: string;
  comment_text: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  profiles?: {
    name: string;
    profile_picture: string | null;
  };
}

interface CommentsProps {
  postId: string;
}

export const Comments = ({ postId }: CommentsProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchComments();
    fetchUser();

    // Subscribe to real-time comments
    const subscription = supabase
      .channel(`post-comments-${postId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${postId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [postId]);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching comments:", error);
      return;
    }

    // Fetch profiles separately
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, profile_picture")
        .in("id", userIds);

      const commentsWithProfiles = data.map(comment => ({
        ...comment,
        profiles: profiles?.find(p => p.id === comment.user_id)
      }));

      setComments(commentsWithProfiles as any);
    } else {
      setComments([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() && !selectedImage) {
      toast.error("Please enter a comment or select an image");
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl = null;

      if (selectedImage) {
        setIsUploading(true);
        const result = await uploadImage(selectedImage, "post-images", "comments");
        imageUrl = result.url;
        setIsUploading(false);
      }

      if (editingId) {
        // Update existing comment
        const { error } = await supabase
          .from("comments")
          .update({
            comment_text: newComment,
            image_url: imageUrl,
          })
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Comment updated");
        setEditingId(null);
      } else {
        // Create new comment
        const { error } = await supabase.from("comments").insert({
          post_id: postId,
          user_id: currentUser?.id,
          comment_text: newComment,
          image_url: imageUrl,
        });

        if (error) throw error;
        toast.success("Comment added");
      }

      setNewComment("");
      setSelectedImage(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const handleDelete = async (commentId: string, imageUrl: string | null) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    try {
      if (imageUrl) {
        const path = imageUrl.split("/").slice(-3).join("/");
        await deleteImage("post-images", path);
      }

      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;
      toast.success("Comment deleted");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setNewComment(comment.comment_text);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold text-foreground">
          Comments ({comments.length})
        </h2>
      </div>

      {/* Comment Form */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
              className="resize-none"
            />

            {/* Image Upload */}
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("comment-image-input")?.click()}
                disabled={isSubmitting}
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                Add Image
              </Button>
              <input
                id="comment-image-input"
                type="file"
                accept="image/*"
                onChange={(e) => setSelectedImage(e.target.files?.[0] || null)}
                className="hidden"
              />
              {selectedImage && (
                <p className="text-sm text-muted-foreground mt-2">
                  Selected: {selectedImage.name}
                </p>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting || isUploading}>
              {isSubmitting || isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isUploading ? "Uploading..." : "Posting..."}
                </>
              ) : editingId ? (
                "Update Comment"
              ) : (
                "Post Comment"
              )}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setNewComment("");
                  setSelectedImage(null);
                }}
                className="ml-2"
              >
                Cancel
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Comments List */}
      <div className="space-y-4">
        {comments.map((comment) => (
          <Card key={comment.id}>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <Avatar>
                  <AvatarImage src={comment.profiles?.profile_picture || ""} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {comment.profiles?.name?.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">
                        {comment.profiles?.name || "Unknown User"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), {
                          addSuffix: true,
                        })}
                        {comment.updated_at !== comment.created_at && " (edited)"}
                      </p>
                    </div>

                    {currentUser?.id === comment.user_id && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(comment)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(comment.id, comment.image_url)}
                        >
                          <Trash className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <p className="text-foreground mt-2">{comment.comment_text}</p>

                  {comment.image_url && (
                    <img
                      src={comment.image_url}
                      alt="Comment attachment"
                      className="mt-3 rounded-lg max-w-full md:max-w-md h-auto max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(comment.image_url!, '_blank')}
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
