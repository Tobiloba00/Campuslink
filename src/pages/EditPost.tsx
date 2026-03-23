import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";
import { uploadImage, deleteImage } from "@/lib/imageUpload";
import { formatNairaInput, parseNairaInput } from "@/lib/utils";
import { BookOpen, GraduationCap, ShoppingBag, Edit, ArrowLeft, Save, Loader2 } from "lucide-react";
import BottomNav from "@/components/BottomNav";

const EditPost = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [displayPrice, setDisplayPrice] = useState("");
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { fetchPost(); }, [id]);

  const fetchPost = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data, error } = await supabase.from('posts').select('*').eq('id', id).single();
      if (error) throw error;
      if (data.user_id !== user.id) { toast.error("You can't edit this post"); navigate("/feed"); return; }
      setTitle(data.title);
      setDescription(data.description);
      setCategory(data.category);
      setPrice(data.optional_price?.toString() || "");
      setDisplayPrice(data.optional_price ? formatNairaInput(data.optional_price.toString()) : "");
      setCurrentImageUrl(data.image_url);
    } catch {
      toast.error("Failed to load post");
      navigate("/feed");
    } finally {
      setFetching(false);
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatNairaInput(e.target.value);
    setDisplayPrice(formatted);
    setPrice(parseNairaInput(formatted));
  };

  const handleImageRemove = async () => {
    if (currentImageUrl) {
      try {
        const path = currentImageUrl.split('/').slice(-3).join('/');
        await deleteImage('post-images', path);
        setCurrentImageUrl(null);
      } catch (error) {
        console.error('Error deleting image:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let imageUrl = currentImageUrl;
      if (selectedImage) {
        setUploading(true);
        if (currentImageUrl) await handleImageRemove();
        imageUrl = (await uploadImage(selectedImage, 'post-images', 'posts')).url;
        setUploading(false);
      }

      const summaryResponse = await supabase.functions.invoke('generate-summary', { body: { description } });

      const { error } = await supabase
        .from('posts')
        .update({
          title, description, category: category as any,
          optional_price: price ? parseFloat(price) : null,
          ai_summary: summaryResponse.data?.summary || null,
          image_url: imageUrl
        })
        .eq('id', id);

      if (error) throw error;
      toast.success("Post updated!");
      navigate(`/post/${id}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update post");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-24 lg:pb-8">
        {/* Header */}
        <div className="mb-8">
          <button onClick={() => navigate(`/post/${id}`)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to post
          </button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center">
              <Edit className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Edit Post</h1>
              <p className="text-sm text-muted-foreground">Update your post details</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="glass-panel border-white/10 p-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required className="h-12 rounded-xl bg-muted/50 border-border/50 text-base font-medium" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</Label>
              <Select value={category} onValueChange={setCategory} required>
                <SelectTrigger className="h-12 rounded-xl bg-muted/50 border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent className="glass-panel border-white/10">
                  <SelectItem value="Academic Help" className="rounded-lg">
                    <span className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-blue-500" /> Academic Help</span>
                  </SelectItem>
                  <SelectItem value="Tutoring" className="rounded-lg">
                    <span className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-emerald-500" /> Tutoring</span>
                  </SelectItem>
                  <SelectItem value="Buy & Sell" className="rounded-lg">
                    <span className="flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-orange-500" /> Buy & Sell</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} required className="rounded-xl bg-muted/50 border-border/50 resize-none text-base leading-relaxed" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Image</Label>
              <ImageUpload onImageSelect={(f) => setSelectedImage(f)} currentImage={currentImageUrl || undefined} onImageRemove={handleImageRemove} isUploading={uploading} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price (optional)</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₦</span>
                <Input id="price" type="text" placeholder="0" value={displayPrice} onChange={handlePriceChange} className="h-12 rounded-xl bg-muted/50 border-border/50 pl-8" />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => navigate(`/post/${id}`)} className="flex-1 h-12 rounded-xl border-border/50 font-semibold">
              Cancel
            </Button>
            <Button type="submit" disabled={loading || uploading} className="flex-1 h-12 rounded-xl bg-gradient-primary shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all font-semibold">
              {uploading || loading ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {uploading ? 'Uploading...' : 'Saving...'}</span>
              ) : (
                <span className="flex items-center gap-2"><Save className="h-4 w-4" /> Save Changes</span>
              )}
            </Button>
          </div>
        </form>
      </div>
      <BottomNav />
    </div>
  );
};

export default EditPost;
