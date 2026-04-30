import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";
import { uploadImage } from "@/lib/imageUpload";
import { formatNairaInput, parseNairaInput } from "@/lib/utils";
import { BookOpen, Users, ShoppingBag, ArrowLeft, Calendar as CalendarIcon, X, Sparkles, Loader2 } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { NotificationOptInPrompt } from "@/components/NotificationOptInPrompt";

const DESCRIPTION_MAX = 500;

const CreatePost = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [displayPrice, setDisplayPrice] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showNotifOptIn, setShowNotifOptIn] = useState(false);

  const handleImageSelect = (file: File) => setSelectedImage(file);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatNairaInput(e.target.value);
    setDisplayPrice(formatted);
    setPrice(parseNairaInput(formatted));
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value.slice(0, DESCRIPTION_MAX);
    setDescription(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Explicit client-side validation — HTML5 required is unreliable
    // across iOS PWA flows, and we want the error toasts to drive the UX.
    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    if (trimmedTitle.length < 4) {
      toast.error("Give your task a title (at least 4 characters)");
      return;
    }
    if (trimmedTitle.length > 120) {
      toast.error("Title is too long — keep it under 120 characters");
      return;
    }
    if (!category) {
      toast.error("Pick a category");
      return;
    }
    if (trimmedDesc.length < 10) {
      toast.error("Add a description so people understand what you need");
      return;
    }
    if (price && (isNaN(parseFloat(price)) || parseFloat(price) < 0)) {
      toast.error("Budget needs to be a positive number");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let imageUrl = null;
      if (selectedImage) {
        setUploading(true);
        const uploadResult = await uploadImage(selectedImage, 'post-images', 'posts');
        imageUrl = uploadResult.url;
        setUploading(false);
      }

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('course, year_of_study, skills, interests')
        .eq('id', user.id)
        .single();

      const summaryResponse = await supabase.functions.invoke('generate-summary', {
        body: { description }
      });

      const analysisResponse = await supabase.functions.invoke('ai-post-analysis', {
        body: {
          postTitle: title,
          postDescription: description,
          userProfile: userProfile || {}
        }
      });

      const analysisData = analysisResponse.data || {};

      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          title: trimmedTitle,
          description: trimmedDesc,
          category: category as any,
          optional_price: price ? parseFloat(price) : null,
          due_date: dueDate ? dueDate.toISOString() : null,
          ai_summary: summaryResponse.data?.summary || null,
          image_url: imageUrl,
          tags: analysisData.tags || [],
          campus_highlight: analysisData.campus_highlight || null,
          match_suggestions: analysisData.match_criteria || null
        } as any);

      if (error) throw error;
      toast.success("Posted!");

      // First-task contextual notification opt-in: ask iff this was post #1
      // and the browser actually supports push (otherwise just bounce to feed).
      const { count: priorPostCount } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      // count is now (their_old_posts + 1) since we just inserted. So === 1 → first-ever.
      if (priorPostCount === 1 && 'Notification' in window && Notification.permission === 'default') {
        setShowNotifOptIn(true);
        return; // don't navigate yet — let the dialog flow finish first
      }

      navigate("/feed");
    } catch (error: any) {
      toast.error(error.message || "Failed to post");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const isSubmitting = loading || uploading;

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop keeps the global navbar */}
      <div className="hidden lg:block">
        <Navbar />
      </div>

      {/* Mobile: slim back-only header */}
      <header
        className="lg:hidden sticky top-0 z-30 bg-background/85 backdrop-blur-xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="h-12 px-2 flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate('/feed')}
            className="h-10 w-10 rounded-full hover:bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-5 pb-32 lg:pt-[88px] lg:pb-12">
        {/* Page heading */}
        <div className="pt-5 pb-7">
          <h1 className="text-[26px] sm:text-3xl font-bold tracking-tight leading-tight">
            Post a New Task
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Fill in the details to get help from other students.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-sm font-semibold text-foreground">Title</Label>
            <Input
              id="title"
              placeholder="e.g. Help with Mathematics Tutorial"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              className="h-12 rounded-xl bg-card border-border/60 focus-visible:ring-primary/20 focus-visible:border-primary/40"
            />
          </div>

          {/* Category — kept because the feed filters depend on it */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-foreground">Category</Label>
            <Select value={category} onValueChange={setCategory} required>
              <SelectTrigger className="h-12 rounded-xl bg-card border-border/60 focus:ring-primary/20">
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Academic Help" className="rounded-lg">
                  <span className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-blue-500" /> Academic Help</span>
                </SelectItem>
                <SelectItem value="Tutoring" className="rounded-lg">
                  <span className="flex items-center gap-2"><Users className="h-4 w-4 text-emerald-500" /> Tutoring</span>
                </SelectItem>
                <SelectItem value="Buy & Sell" className="rounded-lg">
                  <span className="flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-orange-500" /> Buy & Sell</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description with char counter */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-sm font-semibold text-foreground">Description</Label>
            <div className="relative">
              <Textarea
                id="description"
                placeholder="Describe your task in detail..."
                value={description}
                onChange={handleDescriptionChange}
                rows={6}
                required
                maxLength={DESCRIPTION_MAX}
                className="rounded-xl bg-card border-border/60 resize-none text-[15px] leading-relaxed focus-visible:ring-primary/20 focus-visible:border-primary/40 pb-7"
              />
              <span className="absolute bottom-2.5 right-3 text-[11px] text-muted-foreground/70 tabular-nums select-none pointer-events-none">
                {description.length}/{DESCRIPTION_MAX}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1 pl-0.5">
              <Sparkles className="h-3 w-3" /> AI will auto-generate tags and a summary
            </p>
          </div>

          {/* Image — kept because marketplace listings need a photo */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-foreground">Image <span className="text-muted-foreground/70 font-normal text-xs">(optional)</span></Label>
            <ImageUpload onImageSelect={handleImageSelect} isUploading={uploading} />
          </div>

          {/* Budget */}
          <div className="space-y-1.5">
            <Label htmlFor="price" className="text-sm font-semibold text-foreground">
              Budget <span className="text-muted-foreground/70 font-normal text-xs">(optional)</span>
            </Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold pointer-events-none">₦</span>
              <Input
                id="price"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 2000"
                value={displayPrice}
                onChange={handlePriceChange}
                className="h-12 rounded-xl bg-card border-border/60 pl-8 focus-visible:ring-primary/20 focus-visible:border-primary/40"
              />
            </div>
          </div>

          {/* Deadline */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-foreground">Deadline</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 rounded-xl bg-card border-border/60 justify-between font-normal text-[15px] hover:bg-card"
                >
                  <span className={dueDate ? "text-foreground" : "text-muted-foreground"}>
                    {dueDate ? format(dueDate, "PPP") : "Select deadline"}
                  </span>
                  {dueDate ? (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDueDate(undefined); }}
                      className="p-1 rounded hover:bg-muted -mr-1"
                      aria-label="Clear deadline"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </span>
                  ) : (
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Submit */}
          <div className="pt-3">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-[52px] rounded-2xl bg-primary hover:bg-primary/90 font-semibold text-[15px] shadow-md shadow-primary/25"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {uploading ? 'Uploading…' : 'Posting…'}
                </span>
              ) : (
                'Post Task'
              )}
            </Button>
          </div>
        </form>
      </div>
      <BottomNav />

      {/* First-task contextual opt-in (only fires on first post) */}
      <NotificationOptInPrompt
        trigger={showNotifOptIn}
        context="first_task"
        onClose={() => navigate('/feed')}
      />
    </div>
  );
};

export default CreatePost;
