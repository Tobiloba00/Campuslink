import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";
import { uploadImage } from "@/lib/imageUpload";
import { formatNairaInput, parseNairaInput } from "@/lib/utils";

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

      // Upload image if selected
      if (selectedImage) {
        setUploading(true);
        const uploadResult = await uploadImage(selectedImage, 'post-images', 'posts');
        imageUrl = uploadResult.url;
        setUploading(false);
      }

      // Fetch user profile for AI analysis
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('course, year_of_study, skills, interests')
        .eq('id', user.id)
        .single();

      // Generate AI summary
      const summaryResponse = await supabase.functions.invoke('generate-summary', {
        body: { description }
      });

      // AI post analysis for matching and tagging
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-2xl pt-20">
        <Card className="shadow-hover">
          <CardHeader>
            <CardTitle className="text-2xl">Create a New Post</CardTitle>
            <CardDescription>Share your request, offer tutoring, or list items for sale</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Need help with Calculus assignment"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={category} onValueChange={setCategory} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Academic Help">Academic Help</SelectItem>
                    <SelectItem value="Tutoring">Tutoring</SelectItem>
                    <SelectItem value="Buy & Sell">Buy & Sell</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Provide details about your request or offer..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Image (optional)</Label>
                <ImageUpload 
                  onImageSelect={handleImageSelect}
                  isUploading={uploading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price (optional)</Label>
                <Input
                  id="price"
                  type="text"
                  placeholder="e.g., 5,000"
                  value={displayPrice}
                  onChange={handlePriceChange}
                />
                <p className="text-sm text-muted-foreground">
                  Enter amount in Naira (₦)
                </p>
              </div>

              <div className="flex gap-4">
                <Button type="button" variant="outline" onClick={() => navigate("/feed")} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || uploading} className="flex-1">
                  {uploading ? "Uploading..." : loading ? "Creating..." : "Create Post"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreatePost;
