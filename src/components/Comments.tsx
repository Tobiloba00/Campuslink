import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  MessageSquare,
  Image as ImageIcon,
  Loader2,
  Edit,
  Trash,
  Bot,
  Heart,
  MoreHorizontal,
  Send,
  X,
  ChevronDown,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { uploadImage, deleteImage } from "@/lib/imageUpload";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  has_liked?: boolean;
  is_hidden?: boolean;
  descendantCount?: number;
}

interface CommentsProps {
  postId: string;
  postTitle?: string;
  postDescription?: string;
}

/* Cycle of soft-pill colors for the time badge — keeps the thread lively */
const TIME_PILL_COLORS = [
  "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  "bg-primary/10 text-primary",
  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
];

const formatTime = (date: string) =>
  formatDistanceToNow(new Date(date), { addSuffix: false })
    .replace("about ", "")
    .replace("less than a minute", "now")
    .replace(" minutes", "m")
    .replace(" minute", "m")
    .replace(" hours", "h")
    .replace(" hour", "h")
    .replace(" days", "d")
    .replace(" day", "d")
    .replace(" months", "mo")
    .replace(" month", "mo")
    .replace(" years", "y")
    .replace(" year", "y");

export const Comments = ({
  postId,
  postTitle = "",
  postDescription = "",
}: CommentsProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    fetchUser();
    fetchComments();

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
            const { data: fresh } = await supabase
              .from("comments")
              .select(
                `*, profiles:profiles(name, profile_picture), comment_likes(id, user_id)`
              )
              .eq("id", payload.new.id)
              .single();

            if (fresh) {
              const enriched: Comment = {
                ...fresh,
                likes_count: (fresh as any).comment_likes?.length || 0,
                has_liked: (fresh as any).comment_likes?.some(
                  (l: any) => l.user_id === currentUser?.id
                ),
                is_ai: fresh.comment_text.startsWith("🤖 CampusLink AI:"),
              };
              setComments((prev) =>
                sortCommentsForThreadDisplay([...prev, enriched])
              );
            }
          } else if (payload.eventType === "UPDATE") {
            setComments((prev) =>
              sortCommentsForThreadDisplay(
                prev.map((c) =>
                  c.id === payload.new.id ? { ...c, ...payload.new } : c
                )
              )
            );
          } else if (payload.eventType === "DELETE") {
            setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, currentUser?.id]);

  const fetchUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUser(user);
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, profile_picture")
        .eq("id", user.id)
        .single();
      setCurrentProfile(profile);
    }
  };

  const fetchComments = async () => {
    const { data, error } = await (supabase.from("comments") as any)
      .select(
        `*, profiles:profiles(name, profile_picture), comment_likes(id, user_id)`
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching comments:", error);
      toast.error("Could not load comments");
      return;
    }

    if (data) {
      const processed: Comment[] = data.map((c: any) => ({
        ...c,
        likes_count: c.comment_likes?.length || 0,
        has_liked: c.comment_likes?.some(
          (l: any) => l.user_id === currentUser?.id
        ),
        is_ai: c.comment_text.startsWith("🤖 CampusLink AI:"),
      }));
      setComments(sortCommentsForThreadDisplay(processed));
    }
  };

  const sortCommentsForThreadDisplay = (flat: Comment[]): Comment[] => {
    const result: Comment[] = [];
    const childrenMap = new Map<string | null, Comment[]>();
    flat.forEach((c) => {
      const k = c.parent_id || null;
      if (!childrenMap.has(k)) childrenMap.set(k, []);
      childrenMap.get(k)!.push(c);
    });

    const roots = childrenMap.get(null) || [];
    roots.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const traverse = (parent: Comment): number => {
      const children = childrenMap.get(parent.id) || [];
      result.push(parent);
      children.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      let total = children.length;
      children.forEach((c) => {
        total += traverse(c);
      });
      parent.descendantCount = total;
      return total;
    };

    roots.forEach((r) => traverse(r));
    return result;
  };

  const checkForMention = (text: string): string | null => {
    const m = text.match(/@campuslink\s+(.+)/i);
    return m ? m[1].trim() : null;
  };

  const getAiResponse = async (question: string, originalComment: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "ai-comment-reply",
        {
          body: {
            postTitle,
            postDescription,
            commentText: originalComment,
            question,
          },
        }
      );
      if (error) throw error;
      return data.response;
    } catch (e: any) {
      toast.error("Failed to get AI response");
      return null;
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newComment.trim() && !selectedImage) return;

    setIsSubmitting(true);
    try {
      let imageUrl: string | null = null;

      if (selectedImage) {
        setIsUploading(true);
        setUploadProgress(0);
        const tick = setInterval(() => {
          setUploadProgress((p) => Math.min(p + 10, 90));
        }, 200);
        const result = await uploadImage(selectedImage, "post-images", "comments");
        imageUrl = result.url;
        clearInterval(tick);
        setUploadProgress(100);
        setIsUploading(false);
        setTimeout(() => setUploadProgress(0), 400);
      }

      if (editingId) {
        const { error } = await supabase
          .from("comments")
          .update({ comment_text: newComment, image_url: imageUrl })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Comment updated");
        setEditingId(null);
      } else {
        const { error } = await supabase.from("comments").insert({
          post_id: postId,
          user_id: currentUser?.id,
          comment_text: newComment,
          image_url: imageUrl,
          parent_id: replyingTo?.id || null,
        });
        if (error) throw error;

        const question = checkForMention(newComment);
        if (question) {
          const aiResponse = await getAiResponse(question, newComment);
          if (aiResponse) {
            await supabase.from("comments").insert({
              post_id: postId,
              user_id: currentUser?.id,
              comment_text: `🤖 CampusLink AI: ${aiResponse}`,
              image_url: null,
            });
          }
        }
      }

      setNewComment("");
      setSelectedImage(null);
      setReplyingTo(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const handleReply = (id: string, name: string) => {
    setEditingId(null);
    setReplyingTo({ id, name });
    setNewComment("");
    requestAnimationFrame(() => {
      document.getElementById("comment-composer")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      document.getElementById("comment-input")?.focus();
    });
  };

  const handleEdit = (id: string, text: string) => {
    setReplyingTo(null);
    setEditingId(id);
    setNewComment(text);
    requestAnimationFrame(() => {
      document.getElementById("comment-input")?.focus();
    });
  };

  const cancelComposerState = () => {
    setReplyingTo(null);
    setEditingId(null);
    setNewComment("");
    setSelectedImage(null);
  };

  const toggleLike = async (commentId: string, currentLiked: boolean) => {
    if (!currentUser) {
      toast.error("Please log in to like comments");
      return;
    }
    // Optimistic update
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              has_liked: !currentLiked,
              likes_count: (c.likes_count || 0) + (currentLiked ? -1 : 1),
            }
          : c
      )
    );
    try {
      if (currentLiked) {
        await (supabase.from("comment_likes") as any)
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", currentUser.id);
      } else {
        await (supabase.from("comment_likes") as any).insert({
          comment_id: commentId,
          user_id: currentUser.id,
        });
      }
    } catch (error: any) {
      toast.error(error.message);
      // Roll back on error
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                has_liked: currentLiked,
                likes_count: (c.likes_count || 0) + (currentLiked ? 1 : -1),
              }
            : c
        )
      );
    }
  };

  const handleDelete = async (commentId: string, imageUrl: string | null) => {
    if (!confirm("Delete this comment?")) return;
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

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isCommentVisible = (comment: Comment, all: Comment[]) => {
    const map = new Map(all.map((c) => [c.id, c]));
    let cur = comment;
    while (cur.parent_id) {
      if (collapsedIds.has(cur.parent_id)) return false;
      const p = map.get(cur.parent_id);
      if (!p) break;
      cur = p;
    }
    return true;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-primary" />
        <h2 className="text-base font-bold tracking-tight">
          Comments
          <span className="ml-2 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {comments.length}
          </span>
        </h2>
      </div>

      {/* Threaded list */}
      <div className="space-y-1">
        {comments.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Be the first to comment.
          </div>
        )}

        {comments.map((comment, index) => {
          if (!isCommentVisible(comment, comments)) return null;
          const isReply = !!comment.parent_id;
          const isCollapsed = collapsedIds.has(comment.id);
          const directRepliesCount = comments.filter(
            (c) => c.parent_id === comment.id
          ).length;
          const pillColor = TIME_PILL_COLORS[index % TIME_PILL_COLORS.length];

          return (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUser={currentUser}
              isReply={isReply}
              isCollapsed={isCollapsed}
              directRepliesCount={directRepliesCount}
              pillColor={pillColor}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleLike={toggleLike}
              onReply={handleReply}
              onToggleCollapse={() => toggleCollapse(comment.id)}
            />
          );
        })}
      </div>

      {/* Inline composer */}
      <div
        id="comment-composer"
        className="bg-card border border-border/40 rounded-2xl p-3 shadow-sm sticky bottom-2 sm:relative sm:bottom-auto"
      >
        {(replyingTo || editingId) && (
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-semibold text-muted-foreground">
              {editingId
                ? "Editing comment"
                : `Replying to ${replyingTo?.name}`}
            </span>
            <button
              onClick={cancelComposerState}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex items-start gap-3">
          <Avatar className="h-9 w-9 flex-shrink-0">
            <AvatarImage src={currentProfile?.profile_picture || ""} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
              {currentProfile?.name?.charAt(0).toUpperCase() ||
                currentUser?.email?.charAt(0).toUpperCase() ||
                "U"}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <Textarea
              id="comment-input"
              placeholder={
                replyingTo
                  ? "Post your reply..."
                  : "Add a comment... (use @campuslink for AI help)"
              }
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={1}
              className="resize-none border-none bg-transparent px-0 py-1.5 focus-visible:ring-0 text-[15px] leading-relaxed placeholder:text-muted-foreground/70 min-h-0"
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 200) + "px";
              }}
            />

            {newComment.toLowerCase().includes("@campuslink") && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-wider mt-1 animate-pulse">
                <Bot className="h-3 w-3" />
                AI Brain Engaged
              </div>
            )}

            {selectedImage && (
              <div className="relative mt-2 w-fit">
                <img
                  src={URL.createObjectURL(selectedImage)}
                  alt="Selected"
                  className="rounded-xl max-h-[200px] object-cover border border-border/40"
                />
                {isUploading && uploadProgress > 0 && (
                  <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                    <div className="text-center text-white">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-1" />
                      <p className="text-xs font-medium">{uploadProgress}%</p>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-foreground text-background flex items-center justify-center shadow-md"
                  aria-label="Remove image"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                onClick={() =>
                  document.getElementById("comment-image-input")?.click()
                }
                className="h-8 w-8 rounded-full text-primary hover:bg-primary/10 flex items-center justify-center transition-colors"
                aria-label="Attach image"
              >
                <ImageIcon className="h-4 w-4" />
              </button>
              <input
                id="comment-image-input"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => setSelectedImage(e.target.files?.[0] || null)}
              />

              <Button
                size="sm"
                onClick={() => handleSubmit()}
                disabled={
                  (!newComment.trim() && !selectedImage) || isSubmitting
                }
                className="h-9 px-4 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    {editingId ? "Save" : replyingTo ? "Reply" : "Post"}
                    <Send className="h-3 w-3 ml-1.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────
   Single comment row
   ──────────────────────────────────────────── */
interface CommentItemProps {
  comment: Comment;
  currentUser: any;
  isReply: boolean;
  isCollapsed: boolean;
  directRepliesCount: number;
  pillColor: string;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string, imageUrl: string | null) => void;
  onToggleLike: (id: string, currentLiked: boolean) => void;
  onReply: (id: string, name: string) => void;
  onToggleCollapse: () => void;
}

const CommentItem = ({
  comment,
  currentUser,
  isReply,
  isCollapsed,
  directRepliesCount,
  pillColor,
  onEdit,
  onDelete,
  onToggleLike,
  onReply,
  onToggleCollapse,
}: CommentItemProps) => {
  const isAi = comment.is_ai;
  const isOwner = currentUser?.id === comment.user_id;
  const text = isAi
    ? comment.comment_text.replace("🤖 CampusLink AI: ", "")
    : comment.comment_text;
  const name = isAi ? "CampusLink AI" : comment.profiles?.name || "User";

  return (
    <div
      className={cn(
        "relative flex gap-3 py-3",
        isReply && "ml-9 sm:ml-11 pl-3 border-l border-border/50"
      )}
    >
      <Avatar
        className={cn(
          "flex-shrink-0",
          isReply ? "h-8 w-8" : "h-10 w-10",
          isAi && "ring-2 ring-primary/30"
        )}
      >
        <AvatarImage src={comment.profiles?.profile_picture || ""} />
        <AvatarFallback
          className={cn(
            "text-xs font-bold",
            isAi
              ? "bg-primary text-primary-foreground"
              : "bg-primary/10 text-primary"
          )}
        >
          {isAi ? <Bot className="h-4 w-4" /> : name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        {/* Row 1: name + time pill + menu */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-sm truncate">{name}</span>
          <span
            className={cn(
              "px-2 py-0.5 rounded-md text-[11px] font-semibold flex-shrink-0",
              pillColor
            )}
          >
            {formatTime(comment.created_at)}
          </span>

          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1 rounded-md hover:bg-muted"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {isOwner && (
                  <>
                    <DropdownMenuItem
                      onClick={() => onEdit(comment.id, comment.comment_text)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDelete(comment.id, comment.image_url)}
                    >
                      <Trash className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
                {!isOwner && (
                  <DropdownMenuItem disabled>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Report
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Row 2: comment text */}
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
          {text}
        </p>

        {/* Optional image */}
        {comment.image_url && (
          <div className="mt-2 rounded-xl border border-border/40 overflow-hidden max-w-md">
            <img
              src={comment.image_url}
              alt="Comment attachment"
              className="w-full h-auto object-cover max-h-[300px]"
              loading="lazy"
            />
          </div>
        )}

        {/* Row 3: actions — Reply + Like + collapse */}
        <div className="flex items-center gap-4 mt-1.5 text-xs">
          <button
            onClick={() => onReply(comment.id, name)}
            className="text-muted-foreground hover:text-primary font-semibold transition-colors"
          >
            Reply
          </button>

          <button
            onClick={() => onToggleLike(comment.id, !!comment.has_liked)}
            className={cn(
              "flex items-center gap-1 transition-colors font-medium",
              comment.has_liked
                ? "text-rose-500"
                : "text-muted-foreground hover:text-rose-500"
            )}
            aria-label={comment.has_liked ? "Unlike" : "Like"}
          >
            <Heart
              className={cn(
                "h-3.5 w-3.5",
                comment.has_liked && "fill-current"
              )}
            />
            {(comment.likes_count || 0) > 0 && (
              <span>{comment.likes_count}</span>
            )}
          </button>

          {directRepliesCount > 0 && (
            <button
              onClick={onToggleCollapse}
              className="flex items-center gap-1 text-primary font-semibold hover:text-primary/80 transition-colors"
            >
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  !isCollapsed && "rotate-180"
                )}
              />
              {isCollapsed
                ? `Show ${directRepliesCount} ${
                    directRepliesCount === 1 ? "reply" : "replies"
                  }`
                : "Hide replies"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
