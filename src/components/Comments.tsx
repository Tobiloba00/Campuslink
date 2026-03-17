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
import { cn } from "@/lib/utils";
import { Heart, Reply, MoreHorizontal, Smile, Paperclip, ChevronDown, ChevronUp } from "lucide-react";

interface Comment {
  id: string;
  comment_text: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  parent_id?: string | null;
  is_ai?: boolean;
  profiles?: {
    name: string;
    profile_picture: string | null;
  };
  replies?: Comment[];
  likes_count?: number;
  has_liked?: boolean;
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
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
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
    // Explicitly select columns to help bypass cache issues if they appear
    const { data, error } = await supabase
      .from("comments")
      .select(`
        id, 
        comment_text, 
        image_url, 
        created_at, 
        updated_at, 
        user_id, 
        post_id,
        parent_id
      `)
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching comments:", error);
      // Fallback for schema cache issue - try without parent_id if it fails
      if (error.message?.includes("parent_id")) {
        console.warn("Retrying fetch without parent_id due to schema cache delay...");
        const { data: retryData, error: retryError } = await supabase
          .from("comments")
          .select("id, comment_text, image_url, created_at, updated_at, user_id, post_id")
          .eq("post_id", postId)
          .order("created_at", { ascending: true });

        if (!retryError && retryData) {
          processComments(retryData, []);
          return;
        }
      }
      return;
    }

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, profile_picture")
        .in("id", userIds);

      processComments(data, profiles || []);
    } else {
      setComments([]);
    }
  };

  const processComments = (data: any[], profiles: any[]) => {
    const commentMap = new Map<string, Comment>();

    // First pass: Create enriched objects and store in map
    data.forEach(comment => {
      commentMap.set(comment.id, {
        ...comment,
        profiles: profiles?.find(p => p.id === comment.user_id),
        is_ai: comment.comment_text.startsWith('🤖 CampusLink AI:'),
        replies: []
      });
    });

    const rootComments: Comment[] = [];

    // Second pass: Build the tree using references from the map
    data.forEach(comment => {
      const enrichedComment = commentMap.get(comment.id)!;

      if (comment.parent_id && commentMap.has(comment.parent_id)) {
        const parent = commentMap.get(comment.parent_id)!;
        parent.replies!.push(enrichedComment);
      } else {
        rootComments.push(enrichedComment);
      }
    });

    setComments(rootComments);
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
          parent_id: replyingToId
        });

        if (error) throw error;
        toast.success(replyingToId ? "Reply added" : "Comment added");
        setReplyingToId(null);

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

  const submitInlineReply = async (text: string, parentId: string, imageFile: File | null, clearCallback: () => void) => {
    if (!text.trim() && !imageFile) return;

    setIsSubmitting(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        setIsUploading(true);
        const result = await uploadImage(imageFile, "post-images", "comments");
        imageUrl = result.url;
        setIsUploading(false);
      }

      const { error } = await supabase.from("comments").insert({
        post_id: postId,
        user_id: currentUser?.id,
        comment_text: text,
        image_url: imageUrl,
        parent_id: parentId
      });

      if (error) throw error;
      toast.success("Reply added");
      setReplyingToId(null);
      clearCallback();

      const question = checkForMention(text);
      if (question) {
        const aiResponse = await getAiResponse(question, text);
        if (aiResponse) {
          await supabase.from("comments").insert({
            post_id: postId,
            user_id: currentUser?.id,
            comment_text: `🤖 CampusLink AI: ${aiResponse}`,
            image_url: null,
            parent_id: parentId
          });
        }
      }
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Conversation
            <span className="ml-2 text-sm font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {comments.length}
            </span>
          </h2>
        </div>
      </div>

      {/* Modern Thread-Style Form */}
      <div className="group relative">
        <Card className="overflow-hidden border-none shadow-sm bg-muted/30 comment-input-focus">
          <CardContent className="p-0">
            {/* Parent Component Form - the main sticky one */}
            <form onSubmit={handleSubmit}>
              <div className="flex items-start gap-4 p-4">
                <Avatar className="h-10 w-10 shrink-0 ring-2 ring-background shadow-sm">
                  <AvatarImage src={currentUser?.user_metadata?.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {currentUser?.email?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0 space-y-3">
                  <div className="relative">
                    <Textarea
                      placeholder={replyingToId ? "Thread your reply..." : "Share your thoughts... (Use @campuslink for AI help)"}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={newComment.length > 50 ? 3 : 1}
                      className="resize-none border-none bg-transparent p-0 focus-visible:ring-0 text-[15px] leading-relaxed placeholder:text-muted-foreground/60 transition-all duration-300 min-h-[40px]"
                    />
                    {newComment.toLowerCase().includes('@campuslink') && (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-wider mt-1 animate-pulse">
                        <Bot className="h-3 w-3" />
                        AI Brain Engaged
                      </div>
                    )}
                  </div>

                  {selectedImage && (
                    <div className="relative inline-block group/img">
                      <img
                        src={URL.createObjectURL(selectedImage)}
                        className="h-20 w-32 object-cover rounded-xl border border-white/20 shadow-lg"
                        alt="Preview"
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedImage(null)}
                        className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 shadow-xl hover:scale-110 transition-transform"
                      >
                        <Trash className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border/10">
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        onClick={() => document.getElementById("comment-image-input")?.click()}
                        disabled={isSubmitting}
                      >
                        <ImageIcon className="w-4.5 h-4.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Smile className="w-4.5 h-4.5" />
                      </Button>
                      <input
                        id="comment-image-input"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setSelectedImage(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      {(editingId || replyingToId) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 text-muted-foreground hover:bg-transparent"
                          onClick={() => {
                            setEditingId(null);
                            setReplyingToId(null);
                            setNewComment("");
                            setSelectedImage(null);
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        type="submit"
                        disabled={isSubmitting || isUploading || isAiResponding || !newComment.trim()}
                        className="h-9 rounded-full px-6 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                      >
                        {isSubmitting || isUploading || isAiResponding ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : editingId ? (
                          "Update"
                        ) : replyingToId ? (
                          "Reply"
                        ) : (
                          "Comment"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Modern Threaded List */}
      <div className="space-y-2 mt-8">
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            currentUser={currentUser}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onReply={setReplyingToId}
            replyingToId={replyingToId}
            onInlineSubmit={submitInlineReply}
            isSubmitting={isSubmitting || isUploading}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
};

const CommentItem = ({ comment, currentUser, onEdit, onDelete, onReply, replyingToId, onInlineSubmit, isSubmitting, isReply = false, isLastReply = false, depth = 0 }: any) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [inlineText, setInlineText] = useState("");
  const [inlineImage, setInlineImage] = useState<File | null>(null);

  const hasReplies = comment.replies && comment.replies.length > 0;
  const isAi = comment.is_ai;
  const isReplying = replyingToId === comment.id;

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleInlineSubmit = () => {
    if (onInlineSubmit) {
      onInlineSubmit(inlineText, comment.id, inlineImage, () => {
        setInlineText("");
        setInlineImage(null);
      });
    }
  };

  if (isAi && isReply) {
    // Twitter Community Notes / Grok style for AI replies
    return (
      <div className={cn("relative group/item comment-item-transition mt-3", isReply ? "ml-4 sm:ml-12" : "")}>
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary/40 rounded-l-2xl" />
          <div className="flex items-center gap-2 mb-2">
            <Bot className="h-4 w-4 text-primary shrink-0" />
            <span className="font-bold text-sm tracking-tight text-foreground">CampusLink AI</span>
            <span className="text-muted-foreground text-xs">• Context</span>
          </div>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-foreground whitespace-pre-wrap pl-6">
            {comment.comment_text.replace('🤖 CampusLink AI: ', '')}
          </p>
        </div>
        {hasReplies && (
          <div className="space-y-0 mt-3 relative">
            {comment.replies.map((reply: any, index: number) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUser={currentUser}
                onEdit={onEdit}
                onDelete={onDelete}
                onReply={onReply}
                replyingToId={replyingToId}
                onInlineSubmit={onInlineSubmit}
                isSubmitting={isSubmitting}
                isReply={true}
                isLastReply={index === comment.replies.length - 1}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      "relative group/item comment-item-transition flex gap-3 sm:gap-4",
      isReply ? 'mt-0 pt-3 flex-col sm:flex-row' : 'mt-0 pt-6 border-t border-border/40 first:border-0 first:pt-4'
    )}>
      {/* Avatar Column */}
      <div className="flex flex-col items-center shrink-0 w-10 sm:w-12 pt-1 relative hidden sm:flex">
        {isAi ? (
          <div
            className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-sm z-10 shrink-0 cursor-pointer"
            onClick={hasReplies ? toggleExpand : undefined}
          >
            <Bot className="h-5 w-5 text-white" />
          </div>
        ) : (
          <Avatar
            className="h-10 w-10 shrink-0 cursor-pointer hover:opacity-90 transition-opacity z-10 block"
            onClick={hasReplies ? toggleExpand : undefined}
          >
            <AvatarImage src={comment.profiles?.profile_picture || ""} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold">
              {comment.profiles?.name?.charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        )}

        {/* Twitter-style connecting vertical line for threads/replies */}
        {hasReplies && isExpanded && (
          <div
            className="absolute top-11 bottom-0 w-[2px] bg-border hover:bg-border/80 transition-colors -mb-3 z-0 cursor-pointer"
            onClick={toggleExpand}
          />
        )}
        {(isReply && !isLastReply && (!hasReplies || !isExpanded)) && (
          <div className="absolute top-11 bottom-0 w-[2px] bg-border hover:bg-border/80 transition-colors -mb-3 z-0" />
        )}
      </div>

      {/* Content Column */}
      <div className="flex-1 min-w-0 pb-1 flex flex-col pt-1">
        {/* Mobile Header */}
        <div className="sm:hidden flex items-center gap-2 mb-2">
          {isAi ? (
            <div
              className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 cursor-pointer"
              onClick={hasReplies ? toggleExpand : undefined}
            >
              <Bot className="h-4 w-4 text-white" />
            </div>
          ) : (
            <Avatar className="h-8 w-8 shrink-0 cursor-pointer" onClick={hasReplies ? toggleExpand : undefined}>
              <AvatarImage src={comment.profiles?.profile_picture || ""} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                {comment.profiles?.name?.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="font-bold tracking-tight hover:underline cursor-pointer truncate text-[14px]">
              {isAi ? 'CampusLink AI' : comment.profiles?.name || "Unknown User"}
            </span>
            {!isAi && (
              <span className="text-muted-foreground truncate text-[13px]">
                @{comment.profiles?.name?.toLowerCase().replace(/\s+/g, '') || "user"}
              </span>
            )}
            <span className="text-muted-foreground shrink-0 text-[13px]">·</span>
            <span className="text-muted-foreground shrink-0 hover:underline cursor-pointer text-[13px]">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: false }).replace('about ', '').replace('less than a minute', 'now')}
            </span>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden sm:flex items-center gap-1.5 mb-1 flex-wrap min-w-0">
          <span className="font-bold tracking-tight hover:underline cursor-pointer truncate text-[15px]">
            {isAi ? 'CampusLink AI' : comment.profiles?.name || "Unknown User"}
          </span>
          {!isAi && (
            <span className="text-muted-foreground truncate text-[15px]">
              @{comment.profiles?.name?.toLowerCase().replace(/\s+/g, '') || "user"}
            </span>
          )}
          <span className="text-muted-foreground shrink-0">·</span>
          <span className="text-muted-foreground shrink-0 hover:underline cursor-pointer text-[15px]">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: false }).replace('about ', '').replace('less than a minute', 'now')}
          </span>
          {comment.updated_at !== comment.created_at && !isAi && (
            <span className="text-muted-foreground text-xs italic ml-1">(edited)</span>
          )}
        </div>

        <div className="pr-4 mt-1 sm:mt-0">
          <p className="text-[15px] sm:text-[15px] leading-normal text-foreground whitespace-pre-wrap break-words">
            {isAi
              ? comment.comment_text.replace('🤖 CampusLink AI: ', '')
              : comment.comment_text
            }
          </p>

          {comment.image_url && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-border/40 max-w-lg cursor-pointer hover:opacity-95 transition-all w-full">
              <img
                src={comment.image_url}
                alt="Attachment"
                className="w-full h-auto object-cover max-h-[500px]"
                onClick={() => window.open(comment.image_url!, '_blank')}
              />
            </div>
          )}
        </div>

        {/* Twitter-style Action Row */}
        <div className="flex items-center justify-between text-muted-foreground mt-3 max-w-[425px]">
          {!isAi && (
            <button
              onClick={() => {
                onReply(comment.id);
              }}
              className="flex items-center gap-2 group/reply hover:text-primary transition-colors py-1 px-2 -ml-2 rounded-full"
            >
              <div className="p-2 rounded-full group-hover/reply:bg-primary/10 transition-colors">
                <Reply className="w-4 h-4 sm:w-4.5 sm:h-4.5 opacity-80" />
              </div>
            </button>
          )}

          <button className="flex items-center gap-2 group/like hover:text-red-500 transition-colors py-1 px-2 rounded-full">
            <div className="p-2 rounded-full group-hover/like:bg-red-500/10 transition-colors">
              <Heart className="w-4 h-4 sm:w-4.5 sm:h-4.5 opacity-80 group-hover/like:fill-current" />
            </div>
          </button>

          {currentUser?.id === comment.user_id && !isAi && (
            <div className="flex items-center">
              <button
                onClick={() => onEdit(comment)}
                className="flex items-center gap-2 group/edit hover:text-foreground transition-colors py-1 px-2 rounded-full"
              >
                <div className="p-2 rounded-full group-hover/edit:bg-muted transition-colors">
                  <Edit className="w-4 h-4 sm:w-4.5 sm:h-4.5 opacity-80" />
                </div>
              </button>

              <button
                onClick={() => onDelete(comment.id, comment.image_url)}
                className="flex items-center gap-2 group/delete hover:text-red-500 transition-colors py-1 px-2 rounded-full ml-2 sm:ml-6"
              >
                <div className="p-2 rounded-full group-hover/delete:bg-red-500/10 transition-colors">
                  <Trash className="w-4 h-4 sm:w-4.5 sm:h-4.5 opacity-80" />
                </div>
              </button>
            </div>
          )}

          <button className="flex items-center gap-2 group/more hover:text-primary transition-colors py-1 px-2 rounded-full ml-auto">
            <div className="p-2 rounded-full group-hover/more:bg-primary/10 transition-colors">
              <MoreHorizontal className="w-4 h-4 sm:w-4.5 sm:h-4.5 opacity-80" />
            </div>
          </button>
        </div>

        {/* Inline Reply Composer */}
        {isReplying && (
          <div className="mt-3 pr-4 animate-in slide-in-from-top-2 fade-in duration-200">
            <div className="bg-muted/30 border border-border/40 rounded-[20px] p-3 shadow-sm focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0 ring-1 ring-background">
                  <AvatarImage src={currentUser?.user_metadata?.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {currentUser?.email?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 flex flex-col pt-1">
                  <Textarea
                    placeholder="Post your reply..."
                    value={inlineText}
                    onChange={(e) => setInlineText(e.target.value)}
                    className="resize-none border-none bg-transparent p-0 focus-visible:ring-0 text-[15px] leading-relaxed placeholder:text-muted-foreground/60 min-h-[40px]"
                    rows={inlineText.length > 50 ? 3 : 1}
                    autoFocus
                  />

                  {inlineImage && (
                    <div className="relative inline-block group/img mt-2 w-max">
                      <img
                        src={URL.createObjectURL(inlineImage)}
                        className="h-20 w-32 object-cover rounded-xl border border-white/20 shadow-md"
                        alt="Preview"
                      />
                      <button
                        type="button"
                        onClick={() => setInlineImage(null)}
                        className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 shadow-xl hover:scale-110 transition-transform"
                      >
                        <Trash className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/10">
                    <div className="flex gap-1 text-primary">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        onClick={() => document.getElementById(`inline-img-${comment.id}`)?.click()}
                        disabled={isSubmitting}
                      >
                        <ImageIcon className="w-4 h-4" />
                      </Button>
                      <input
                        id={`inline-img-${comment.id}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) => setInlineImage(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-full text-xs font-semibold px-4 text-muted-foreground hover:bg-transparent"
                        onClick={() => {
                          onReply(null);
                          setInlineText("");
                          setInlineImage(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 px-4 rounded-full font-bold text-xs hover:scale-[1.02] transition-transform shadow-md"
                        onClick={handleInlineSubmit}
                        disabled={(!inlineText.trim() && !inlineImage) || isSubmitting}
                      >
                        {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Reply"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Collapse Toggle */}
        {hasReplies && !isExpanded && (
          <div className="mt-2 text-[14px] text-primary hover:underline cursor-pointer flex items-center gap-1 font-medium select-none" onClick={toggleExpand}>
            <ChevronDown className="h-4 w-4" />
            Show {comment.replies.length} repl{comment.replies.length === 1 ? 'y' : 'ies'}
          </div>
        )}

        {hasReplies && isExpanded && (
          <div className="mt-2 text-[14px] text-primary/60 hover:text-primary cursor-pointer flex items-center gap-1 font-medium select-none w-fit" onClick={toggleExpand}>
            <ChevronUp className="h-4 w-4" />
            Collapse thread
          </div>
        )}

        {/* Render Replies Linearly Below (Twitter Thread Style) */}
        {hasReplies && isExpanded && (
          <div className="space-y-0 mt-2">
            {comment.replies.map((reply: any, index: number) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUser={currentUser}
                onEdit={onEdit}
                onDelete={onDelete}
                onReply={onReply}
                replyingToId={replyingToId}
                onInlineSubmit={onInlineSubmit}
                isSubmitting={isSubmitting}
                isReply={true}
                isLastReply={index === comment.replies.length - 1}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};