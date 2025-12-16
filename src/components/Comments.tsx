import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { MessageSquare, Image as ImageIcon, Loader2, Edit, Trash, Bot } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { uploadImage, deleteImage } from "@/lib/imageUpload";

interface Comment {
  id: string;
  comment_text: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  is_ai?: boolean;
  profiles?: {
    name: string;
    profile_picture: string | null;
  };
}

interface CommentsProps {
  postId: string;
  postTitle?: string;
  postDescription?: string;
}

export const Comments = ({ postId, postTitle = "", postDescription = "" }: CommentsProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAiResponding, setIsAiResponding] = useState(false);

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
      .order("created_at", { ascending: true });

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
        profiles: profiles?.find(p => p.id === comment.user_id),
        is_ai: comment.comment_text.startsWith('🤖 CampusLink AI:')
      }));

      setComments(commentsWithProfiles as any);
    } else {
      setComments([]);
    }
  };

  const checkForMention = (text: string): string | null => {
    const mentionRegex = /@campuslink\s+(.+)/i;
    const match = text.match(mentionRegex);
    return match ? match[1].trim() : null;
  };

  const getAiResponse = async (question: string, originalComment: string) => {
    try {
      setIsAiResponding(true);
      
      const { data, error } = await supabase.functions.invoke('ai-comment-reply', {
        body: {
          postTitle,
          postDescription,
          commentText: originalComment,
          question
        }
      });

      if (error) throw error;
      
      return data.response;
    } catch (error: any) {
      console.error('Error getting AI response:', error);
      toast.error('Failed to get AI response');
      return null;
    } finally {
      setIsAiResponding(false);
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

        // Check for @campuslink mention
        const question = checkForMention(newComment);
        if (question) {
          const aiResponse = await getAiResponse(question, newComment);
          if (aiResponse) {
            // Post AI response as a comment
            await supabase.from("comments").insert({
              post_id: postId,
              user_id: currentUser?.id, // Using same user since we don't have a system user
              comment_text: `🤖 CampusLink AI: ${aiResponse}`,
              image_url: null,
            });
          }
        }
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
            <div className="relative">
              <Textarea
                placeholder="Write a comment... Use @campuslink to ask AI a question!"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
                className="resize-none pr-4"
              />
              {newComment.toLowerCase().includes('@campuslink') && (
                <div className="absolute bottom-2 right-2 flex items-center gap-1 text-xs text-primary">
                  <Bot className="h-3 w-3" />
                  AI will respond
                </div>
              )}
            </div>

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

            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting || isUploading || isAiResponding}>
                {isSubmitting || isUploading || isAiResponding ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isUploading ? "Uploading..." : isAiResponding ? "AI responding..." : "Posting..."}
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
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Comments List */}
      <div className="space-y-4">
        {comments.map((comment) => (
          <Card key={comment.id} className={comment.is_ai ? 'border-primary/30 bg-primary/5' : ''}>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                {comment.is_ai ? (
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                ) : (
                  <Avatar>
                    <AvatarImage src={comment.profiles?.profile_picture || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {comment.profiles?.name?.charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                )}

                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className={`font-medium ${comment.is_ai ? 'text-primary' : 'text-foreground'}`}>
                        {comment.is_ai ? 'CampusLink AI' : comment.profiles?.name || "Unknown User"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), {
                          addSuffix: true,
                        })}
                        {comment.updated_at !== comment.created_at && !comment.is_ai && " (edited)"}
                      </p>
                    </div>

                    {currentUser?.id === comment.user_id && !comment.is_ai && (
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

                  <p className="text-foreground mt-2">
                    {comment.is_ai 
                      ? comment.comment_text.replace('🤖 CampusLink AI: ', '')
                      : comment.comment_text
                    }
                  </p>

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