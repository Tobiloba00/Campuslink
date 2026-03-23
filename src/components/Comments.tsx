import { useState, useEffect, useMemo } from "react";
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
import { Heart, Reply, MoreHorizontal, Smile, Paperclip, ChevronDown, ChevronUp, Bookmark, Share2, Repeat2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Comment {
  id: string;
  comment_text: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  post_id: string;
  parent_id?: string | null;
  is_ai?: boolean;
  profiles?: {
    name: string;
    profile_picture: string | null;
  };
  replies?: Comment[];
  likes_count?: number;
  reposts_count?: number;
  bookmarks_count?: number;
  quotes_count?: number;
  view_count?: number;
  has_liked?: boolean;
  has_reposted?: boolean;
  has_bookmarked?: boolean;
  is_hidden?: boolean;
  reply_settings?: string;
  self_thread?: boolean;
  thread_position?: number;
  possibly_sensitive?: boolean;
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
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    fetchUser();
    fetchComments();

    // Subscribe to real-time comments with granular patching
    const channel = supabase
      .channel(`post-comments-${postId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${postId}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            // Fetch fully enriched comment
            const { data: newComment } = await supabase
              .from("comments")
              .select(`
                *,
                profiles:profiles(name, profile_picture),
                comment_likes(id),
                reposts(id),
                bookmarks(id)
              `)
              .eq("id", payload.new.id)
              .single();

            if (newComment) {
              const enriched = {
                ...newComment,
                has_liked: newComment.comment_likes?.some((l: any) => l.user_id === currentUser?.id),
                has_reposted: newComment.reposts?.some((r: any) => r.user_id === currentUser?.id),
                has_bookmarked: newComment.bookmarks?.some((b: any) => b.user_id === currentUser?.id),
                is_ai: newComment.comment_text.startsWith('🤖 CampusLink AI:')
              };
              setComments(prev => sortCommentsForThreadDisplay([...prev, enriched]));
            }
          } else if (payload.eventType === "UPDATE") {
            setComments(prev => {
              const updated = prev.map(c => 
                c.id === payload.new.id ? { ...c, ...payload.new } : c
              );
              return sortCommentsForThreadDisplay(updated);
            });
          } else if (payload.eventType === "DELETE") {
            setComments(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, currentUser?.id]);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const fetchComments = async () => {
    const { data, error } = await (supabase
      .from("comments") as any)
      .select(`
        *,
        profiles:profiles(name, profile_picture),
        comment_likes(id, user_id),
        reposts(id, user_id),
        bookmarks(id, user_id)
      `)
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching comments:", error);
      toast.error(`Could not load comments: ${error.message} (Did you run the migration?)`);
      return;
    }

    if (data) {
      const processed = data.map(c => ({
        ...c,
        // Use actual comment_likes count instead of broken likes_count column
        likes_count: (c.comment_likes as any[])?.length || 0,
        has_liked: (c.comment_likes as any[])?.some(l => l.user_id === currentUser?.id),
        has_reposted: (c.reposts as any[])?.some(r => r.user_id === currentUser?.id),
        has_bookmarked: (c.bookmarks as any[])?.some(b => b.user_id === currentUser?.id),
        is_ai: c.comment_text.startsWith('🤖 CampusLink AI:')
      } as any));

      const sorted = sortCommentsForThreadDisplay(processed as any[]);
      setComments(sorted);

      // Auto-collapse all parent comments that have replies
      const parentsWithReplies = new Set(
        processed.filter(c => c.parent_id).map(c => c.parent_id)
      );
      setCollapsedIds(parentsWithReplies as Set<string>);
    }
  };

  // O(n) threaded comment sort using a children map instead of repeated .filter()
  const sortCommentsForThreadDisplay = (flatComments: Comment[]): Comment[] => {
    const result: Comment[] = [];

    // Build parent → children map in one pass (O(n))
    const childrenMap = new Map<string | null, Comment[]>();
    flatComments.forEach(c => {
      const parentKey = c.parent_id || null;
      if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
      childrenMap.get(parentKey)!.push(c);
    });

    // Sort root comments: newest first
    const roots = childrenMap.get(null) || [];
    roots.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Recursive traverse using the map (O(1) child lookup per node)
    const descendantCounts = new Map<string, number>();
    const traverse = (parent: Comment): number => {
      const children = childrenMap.get(parent.id) || [];
      result.push(parent);

      // Sort children by actual like count (from comment_likes join, not broken column)
      children.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));

      let total = children.length;
      children.forEach(child => { total += traverse(child); });

      descendantCounts.set(parent.id, total);
      (parent as any).descendantCount = total;
      return total;
    };

    roots.forEach(root => traverse(root));
    return result;
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
        setUploadProgress(0);

        // Simulate upload progress (replace with actual progress if uploadImage supports it)
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => Math.min(prev + 10, 90));
        }, 200);

        const result = await uploadImage(selectedImage, "post-images", "comments");
        imageUrl = result.url;

        clearInterval(progressInterval);
        setUploadProgress(100);
        setIsUploading(false);
        setTimeout(() => setUploadProgress(0), 500);
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
      setIsComposerOpen(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const handleReply = (id: string | null) => {
    setReplyingToId(id);
    setEditingId(null);
    setNewComment("");
    setIsComposerOpen(true);
  };

  
  const toggleLike = async (commentId: string, currentLiked: boolean) => {
    if (!currentUser) {
      toast.error("Please login to like comments");
      return;
    }
    
    try {
      if (currentLiked) {
        await (supabase.from("comment_likes") as any).delete().eq("comment_id", commentId).eq("user_id", currentUser.id);
      } else {
        await (supabase.from("comment_likes") as any).insert({ comment_id: commentId, user_id: currentUser.id });
      }
      // fetchComments will be triggered by real-time subscription
    } catch (error: any) {
      toast.error(error.message);
    }
  };


  const toggleBookmark = async (commentId: string, currentBookmarked: boolean) => {
    if (!currentUser) return;
    try {
      if (currentBookmarked) {
        await (supabase.from("bookmarks") as any).delete().eq("comment_id", commentId).eq("user_id", currentUser.id);
      } else {
        await (supabase.from("bookmarks") as any).insert({ comment_id: commentId, user_id: currentUser.id });
      }
    } catch (error: any) {
      toast.error(error.message);
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

  const handleEdit = (id: string, text: string) => {
    setEditingId(id);
    setReplyingToId(null);
    setNewComment(text);
    setIsComposerOpen(true);
  };

  const toggleCollapse = (id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isCommentVisible = (comment: Comment, allComments: Comment[]) => {
    const commentMap = new Map(allComments.map(c => [c.id, c]));
    let current = comment;
    while (current.parent_id) {
      if (collapsedIds.has(current.parent_id)) return false;
      const parent = commentMap.get(current.parent_id);
      if (!parent) break;
      current = parent;
    }
    return true;
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
      {/* Sticky Composer Bar (Twitter Style) */}
      <div className="fixed bottom-0 lg:bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-t border-border/40 pb-[env(safe-area-inset-bottom)] mb-20 lg:mb-0 animate-in slide-in-from-bottom duration-300">
        <div className="container max-w-2xl mx-auto px-4 py-2 flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={currentUser?.user_metadata?.avatar_url || ""} />
            <AvatarFallback>{currentUser?.email?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
          </Avatar>
          
          <Dialog open={isComposerOpen} onOpenChange={setIsComposerOpen}>
            <DialogTrigger asChild>
              <div 
                className="flex-1 bg-muted/50 rounded-full py-2 px-4 text-muted-foreground text-[15px] cursor-pointer hover:bg-muted transition-colors"
                onClick={() => handleReply(null)}
              >
                {replyingToId ? "Post your reply" : "Share your thoughts..."}
              </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] p-0 gap-0 border-none overflow-hidden bg-background">
              <DialogHeader className="px-4 py-2 border-b border-border/40 flex flex-row items-center justify-between">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-primary font-bold"
                  onClick={() => setIsComposerOpen(false)}
                >
                  Cancel
                </Button>
                <DialogTitle className="hidden">{editingId ? 'Edit Post' : 'Reply'}</DialogTitle>
                <Button 
                  size="sm" 
                  className="rounded-full font-bold px-5" 
                  onClick={handleSubmit}
                  disabled={!newComment.trim() && !selectedImage || isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingId ? "Save" : "Reply")}
                </Button>
              </DialogHeader>
              <div className="p-4 flex gap-4">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={currentUser?.user_metadata?.avatar_url || ""} />
                  <AvatarFallback>{currentUser?.email?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 flex flex-col gap-2">
                  <Textarea
                    placeholder={replyingToId ? "Post your reply" : "Share your thoughts... (Use @campuslink for AI help)"}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="resize-none border-none bg-transparent p-0 focus-visible:ring-0 text-[19px] leading-relaxed placeholder:text-muted-foreground/60 min-h-[120px]"
                    autoFocus
                  />
                  {newComment.toLowerCase().includes('@campuslink') && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-wider mt-1 animate-pulse">
                      <Bot className="h-3 w-3" />
                      AI Brain Engaged
                    </div>
                  )}
                  {selectedImage && (
                    <div className="relative mt-2 w-fit">
                      <img
                        src={URL.createObjectURL(selectedImage)}
                        alt="Selected image preview"
                        className="rounded-2xl max-h-[300px] object-cover border border-border"
                      />
                      {isUploading && uploadProgress > 0 && (
                        <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                          <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-2" />
                            <p className="text-white text-sm font-medium">{uploadProgress}%</p>
                          </div>
                        </div>
                      )}
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 rounded-full h-8 w-8"
                        onClick={() => setSelectedImage(null)}
                        aria-label="Remove image"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-2 border-t border-border/40 flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-primary rounded-full"
                  onClick={() => document.getElementById('modal-image-upload')?.click()}
                >
                  <ImageIcon className="h-5 w-5" />
                </Button>
                <input 
                  id="modal-image-upload" 
                  type="file" 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => setSelectedImage(e.target.files?.[0] || null)}
                />
              </div>
            </DialogContent>
          </Dialog>

          <Button 
            size="sm" 
            className="rounded-full font-bold px-5 shadow-sm"
            onClick={handleSubmit}
            disabled={!newComment.trim() && !selectedImage || isSubmitting}
          >
            Reply
          </Button>
        </div>
      </div>


      {/* Modern Threaded List */}

      {/* Modern Threaded List */}
      <div className="flex flex-col">
        {comments.map((comment, index) => {
          if (!isCommentVisible(comment, comments)) return null;

          const nextComment = comments.find((c, i) => i > index && isCommentVisible(c, comments));
          const hasConnectorBelow = nextComment?.parent_id === comment.id;
          const isCollapsed = collapsedIds.has(comment.id);
          
          return (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUser={currentUser}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleLike={toggleLike}
              onToggleBookmark={toggleBookmark}
              onReply={handleReply}
              hasConnectorBelow={hasConnectorBelow}
              isCollapsed={isCollapsed}
              onToggleCollapse={() => toggleCollapse(comment.id)}
            />
          );
        })}
      </div>
    </div>
  );
};

const CommentItem = ({
  comment,
  currentUser,
  onEdit,
  onDelete,
  onReply,
  onToggleLike,
  onToggleBookmark,
  hasConnectorBelow,
  isCollapsed,
  onToggleCollapse
}: any) => {
  const isAi = comment.is_ai;
  const directReplyCount = comment.replies?.length || 0;
  const totalDescendants = comment.descendantCount || 0;

  return (
    <div className="relative group/item flex flex-col">
      <div className="flex gap-3 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer">
        {/* Left Column: Avatar & Connector Line */}
        <div className="flex flex-col items-center shrink-0">
          <Avatar className="h-10 w-10 border-2 border-primary/20">
            <AvatarImage src={comment.profiles?.profile_picture} />
            <AvatarFallback>{comment.profiles?.name?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          
          {hasConnectorBelow && (
            <div className="w-0.5 grow bg-border/40 mt-1 rounded-full" />
          )}
        </div>

        {/* Right Column: Content */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Row 1: Metadata */}
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold text-[15px] truncate hover:underline">
                {comment.profiles?.name}
              </span>
              <span className="text-muted-foreground text-[14px] truncate">
                @{comment.profiles?.name?.toLowerCase().replace(/\s+/g, '')}
              </span>
              <span className="text-muted-foreground text-[14px]">·</span>
              <span className="text-muted-foreground text-[14px] shrink-0">
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: false })
                  .replace('about ', '')
                  .replace(' minutes', 'm')
                  .replace(' minute', 'm')
                  .replace(' hours', 'h')
                  .replace(' hour', 'h')
                  .replace(' days', 'd')
                  .replace(' day', 'd')}
              </span>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-primary transition-colors p-1 rounded-full hover:bg-primary/10 -mr-2"
                >
                  <MoreHorizontal className="h-4.5 w-4.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {currentUser?.id === comment.user_id && (
                  <>
                    <DropdownMenuItem onClick={() => onEdit(comment.id, comment.comment_text)}>
                      <Edit className="mr-2 h-4 w-4" />
                      <span>Edit</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive" 
                      onClick={() => onDelete(comment.id, comment.image_url)}
                    >
                      <Trash className="mr-2 h-4 w-4" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  <span>Report</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Row 2: Reply Text */}
          <p className="text-[15px] leading-normal text-foreground whitespace-pre-wrap break-words mb-3">
            {isAi ? comment.comment_text.replace('🤖 CampusLink AI: ', '') : comment.comment_text}
          </p>

          {/* Optional Media */}
          {comment.image_url && (
            <div className="mb-3 rounded-2xl border border-border overflow-hidden bg-muted/20 max-w-lg">
              <img src={comment.image_url} alt="Comment attachment" className="w-full h-auto object-cover max-h-[400px]" />
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between text-muted-foreground -ml-2 max-w-sm">
            <button
              onClick={(e) => { e.stopPropagation(); onReply(comment.id); }}
              className="flex items-center gap-1.5 group/act hover:text-primary transition-colors p-2 rounded-full hover:bg-primary/10"
              aria-label="Reply to comment"
            >
              <Reply className="h-4.5 w-4.5" />
              {directReplyCount > 0 && !isCollapsed && (
                <span className="text-[13px] font-medium">{directReplyCount}</span>
              )}
            </button>

            {totalDescendants > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
                className="flex items-center gap-1.5 group/act hover:text-primary transition-colors p-2 rounded-full hover:bg-primary/10"
                aria-label={isCollapsed ? `Show ${totalDescendants} replies` : "Hide replies"}
              >
                {isCollapsed ? (
                  <>
                    <ChevronDown className="h-4.5 w-4.5" />
                    <span className="text-[13px] font-bold text-primary">Show {totalDescendants} {totalDescendants === 1 ? 'reply' : 'replies'}</span>
                  </>
                ) : (
                  <ChevronUp className="h-4.5 w-4.5" />
                )}
              </button>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); onToggleLike(comment.id, comment.has_liked); }}
              className={cn("flex items-center gap-1.5 group/act hover:text-pink-500 transition-colors p-2 rounded-full hover:bg-pink-500/10", comment.has_liked && "text-pink-500")}
              aria-label={comment.has_liked ? "Unlike comment" : "Like comment"}
            >
              <Heart className={cn("h-4.5 w-4.5", comment.has_liked && "fill-current")} />
              {(comment.likes_count || 0) > 0 && (
                <span className="text-[13px] font-medium">{comment.likes_count}</span>
              )}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onToggleBookmark(comment.id, comment.has_bookmarked); }}
              className={cn("flex items-center gap-1.5 group/act hover:text-primary transition-colors p-2 rounded-full hover:bg-primary/10", comment.has_bookmarked && "text-primary")}
              aria-label={comment.has_bookmarked ? "Remove bookmark" : "Bookmark comment"}
            >
              <Bookmark className={cn("h-4.5 w-4.5", comment.has_bookmarked && "fill-current")} />
              {(comment.bookmarks_count || 0) > 0 && (
                <span className="text-[13px] font-medium">{comment.bookmarks_count}</span>
              )}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(`${window.location.origin}/post/${comment.post_id}`);
                toast.success("Link copied to clipboard");
              }}
              className="flex items-center gap-1.5 group/act hover:text-primary transition-colors p-2 rounded-full hover:bg-primary/10"
              aria-label="Share comment"
            >
              <Share2 className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};