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
import { BookOpen, GraduationCap, ShoppingBag, Sparkles, ArrowLeft, Send } from "lucide-react";
import BottomNav from "@/components/BottomNav";

const CreatePost = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [displayPrice, setDisplayPrice] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleImageSelect = (file: File) => {
    setSelectedImage(file);
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const formatted = formatNairaInput(rawValue);
    setDisplayPrice(formatted);
    setPrice(parseNairaInput(formatted));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          title,
          description,
          category: category as any,
          optional_price: price ? parseFloat(price) : null,
          ai_summary: summaryResponse.data?.summary || null,
          image_url: imageUrl,
          tags: analysisData.tags || [],
          campus_highlight: analysisData.campus_highlight || null,
          match_suggestions: analysisData.match_criteria || null
        });

      if (error) throw error;
      toast.success("Post created successfully!");
      navigate("/feed");
    } catch (error: any) {
      toast.error(error.message || "Failed to create post");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const getCategoryInfo = () => {
    switch (category) {
      case 'Academic Help': return { icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10' };
      case 'Tutoring': return { icon: GraduationCap, color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
      case 'Buy & Sell': return { icon: ShoppingBag, color: 'text-orange-500', bg: 'bg-orange-500/10' };
      default: return null;
    }
  };

  const catInfo = getCategoryInfo();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-[76px] pb-24 lg:pb-8">
        {/* Header */}
        <div className="mb-8 animate-hero">
          <button
            onClick={() => navigate('/feed')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to feed
          </button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Create Post</h1>
              <p className="text-sm text-muted-foreground">AI will auto-tag and summarize your post</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 animate-hero-delayed">
          <div className="glass-panel border-white/10 p-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</Label>
              <Input
                id="title"
                placeholder="e.g., Need help with Calculus assignment"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="h-12 rounded-xl bg-muted/50 border-border/50 text-base font-medium"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</Label>
              <Select value={category} onValueChange={setCategory} required>
                <SelectTrigger className="h-12 rounded-xl bg-muted/50 border-border/50">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent className="glass-panel border-white/10">
                  <SelectItem value="Academic Help" className="rounded-lg">
                    <span className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-blue-500" /> Academic Help
                    </span>
                  </SelectItem>
                  <SelectItem value="Tutoring" className="rounded-lg">
                    <span className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-emerald-500" /> Tutoring
                    </span>
                  </SelectItem>
                  <SelectItem value="Buy & Sell" className="rounded-lg">
                    <span className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-orange-500" /> Buy & Sell
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {catInfo && (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${catInfo.bg} text-xs font-semibold ${catInfo.color}`}>
                  <catInfo.icon className="h-3 w-3" />
                  {category}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</Label>
              <Textarea
                id="description"
                placeholder="Provide details about your request or offer..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                required
                className="rounded-xl bg-muted/50 border-border/50 resize-none text-base leading-relaxed"
              />
              <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                AI will generate tags and a summary automatically
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Image (optional)</Label>
              <ImageUpload
                onImageSelect={handleImageSelect}
                isUploading={uploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price (optional)</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₦</span>
                <Input
                  id="price"
                  type="text"
                  placeholder="0"
                  value={displayPrice}
                  onChange={handlePriceChange}
                  className="h-12 rounded-xl bg-muted/50 border-border/50 pl-8"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/feed")}
              className="flex-1 h-12 rounded-xl border-border/50 hover:bg-muted/50 font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || uploading}
              className="flex-1 h-12 rounded-xl bg-gradient-primary shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.99] transition-all font-semibold"
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading...
                </span>
              ) : loading ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Publish Post
                </span>
              )}
            </Button>
          </div>
        </form>
      </div>
      <BottomNav />
    </div>
  );
};

export default CreatePost;
