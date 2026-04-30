import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Star, ArrowLeft, Send, ShieldCheck, Loader2 } from "lucide-react";

const MAX_REVIEW = 500;

const RateUser = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const fetchData = async () => {
    try {
      // Guard against /rate-user/ with no id, /rate-user/undefined, etc.
      if (!userId) {
        navigate("/not-found", { replace: true });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setCurrentUser(user);

      if (user.id === userId) {
        toast.error("You cannot rate yourself");
        navigate(-1);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116" || /no rows/i.test(error.message)) {
          navigate("/not-found", { replace: true });
        } else {
          toast.error("Failed to load user profile");
          navigate(-1);
        }
        return;
      }
      setProfile(data);
    } catch (error: any) {
      toast.error("Failed to load user profile");
      navigate(-1);
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    setLoading(true);

    try {
      if (!currentUser) throw new Error("Not authenticated");

      const { error } = await supabase.from("reviews").insert({
        reviewer_id: currentUser.id,
        reviewed_user_id: userId,
        rating,
        comment: comment.trim() || null,
      });

      if (error) {
        if (error.message.includes("violates check constraint")) {
          toast.error("You cannot rate yourself");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Review submitted successfully!");
      navigate(-1);
    } catch (error: any) {
      toast.error(error.message || "Failed to submit review");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center pt-[calc(env(safe-area-inset-top,0px)+7rem)]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const displayRating = hoveredRating || rating;
  const ratingTouched = rating > 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-5 pt-[calc(env(safe-area-inset-top,0px)+76px)] pb-32 lg:pb-12">
        {/* ─── Hero ─── */}
        <div className="flex items-start gap-3 mb-6 animate-hero">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="h-10 w-10 rounded-xl bg-card border border-border/50 shadow-sm flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0 mt-1"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-[30px] sm:text-[36px] font-extrabold tracking-tight leading-[1.05] mb-1">
              Rate User
            </h1>
            <p className="text-sm sm:text-[15px] text-muted-foreground leading-relaxed">
              Share your experience and help others
            </p>
          </div>
          <RateArtwork />
        </div>

        {/* ─── Card ─── */}
        <form
          onSubmit={handleSubmit}
          className="bg-card rounded-3xl border border-border/40 shadow-sm overflow-hidden"
        >
          <div className="p-4 sm:p-5">
            {/* User mini-card */}
            <div className="bg-muted/40 dark:bg-muted/20 rounded-2xl p-4 flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-card">
                <AvatarImage src={profile?.profile_picture || ""} alt={profile?.name} />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground font-bold">
                  {profile?.name?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg leading-tight truncate">
                  {profile?.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Current Rating
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="text-sm font-semibold">
                    {profile?.rating > 0
                      ? Number(profile.rating).toFixed(1)
                      : "No ratings yet"}
                  </span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="my-5 border-t border-border/50" />

            {/* Star rating */}
            <div>
              <label className="block text-base font-bold mb-1">
                Your Rating
              </label>
              <p className="text-sm text-muted-foreground mb-4">
                Tap a star to rate
              </p>

              <div className="flex items-center gap-3 sm:gap-4 mb-4">
                {[1, 2, 3, 4, 5].map((star) => {
                  const filled = star <= displayRating;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
                      className="transition-transform hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-md"
                    >
                      <Star
                        className={`h-11 w-11 sm:h-12 sm:w-12 transition-colors ${
                          filled
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                        }`}
                        strokeWidth={1.6}
                      />
                    </button>
                  );
                })}
              </div>

              {ratingTouched && (
                <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-xl text-sm font-semibold animate-fade-in">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  You selected {rating} star{rating !== 1 ? "s" : ""}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="my-6 border-t border-border/50" />

            {/* Review */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label
                  htmlFor="review"
                  className="text-base font-bold"
                >
                  Your Review{" "}
                  <span className="font-medium text-muted-foreground">
                    (optional)
                  </span>
                </label>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  {comment.length}/{MAX_REVIEW}
                </span>
              </div>
              <Textarea
                id="review"
                placeholder="Share your experience..."
                value={comment}
                onChange={(e) =>
                  setComment(e.target.value.slice(0, MAX_REVIEW))
                }
                rows={4}
                className="resize-none rounded-2xl border-border/50 bg-card focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 text-sm leading-relaxed"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(-1)}
                className="flex-1 h-12 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold border-0"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || rating === 0}
                className="flex-[1.6] h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md shadow-primary/25 disabled:opacity-50 disabled:shadow-none"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Submit Review
                    <Send className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Trust footer */}
          <div className="border-t border-border/50 px-4 sm:px-5 py-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Your review is private and helps build a trusted campus community.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────
   Inline artwork — chat bubble with star
   ──────────────────────────────────────────── */
const RateArtwork = () => (
  <svg
    width="92"
    height="92"
    viewBox="0 0 100 100"
    className="flex-shrink-0 sm:w-[110px] sm:h-[110px]"
    fill="none"
    aria-hidden="true"
  >
    {/* Soft blob backdrop */}
    <ellipse
      cx="55"
      cy="48"
      rx="38"
      ry="32"
      fill="hsl(var(--primary) / 0.10)"
    />

    {/* Sparkles */}
    <path
      d="M86 18 L88 24 L94 26 L88 28 L86 34 L84 28 L78 26 L84 24 Z"
      fill="hsl(var(--primary) / 0.55)"
    />
    <path
      d="M22 32 L23 35 L26 36 L23 37 L22 40 L21 37 L18 36 L21 35 Z"
      fill="hsl(var(--primary) / 0.45)"
    />
    <circle cx="92" cy="50" r="2" fill="hsl(var(--primary) / 0.5)" />

    {/* Heart */}
    <path
      d="M86 70 a4 4 0 0 1 7 0 c2.5 3.5 -7 9 -7 9 s-9.5 -5.5 -7 -9 a4 4 0 0 1 7 0 z"
      fill="hsl(var(--primary) / 0.35)"
    />

    {/* Chat bubble */}
    <path
      d="M30 28 H78 a8 8 0 0 1 8 8 v22 a8 8 0 0 1 -8 8 H56 l-10 10 v-10 H30 a8 8 0 0 1 -8 -8 V36 a8 8 0 0 1 8 -8 z"
      fill="hsl(var(--primary))"
    />

    {/* Star inside bubble */}
    <path
      d="M54 38 L57 44.5 L64 45.5 L59 50.5 L60.5 57.5 L54 54 L47.5 57.5 L49 50.5 L44 45.5 L51 44.5 Z"
      fill="white"
    />
  </svg>
);

export default RateUser;
