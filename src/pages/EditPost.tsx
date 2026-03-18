import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { uploadImage, deleteImage } from "@/lib/imageUpload";
import { formatNairaInput, parseNairaInput } from "@/lib/utils";

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

  useEffect(() => {
    fetchPost();
  }, [id]);

  const fetchPost = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data.user_id !== user.id) {
        toast.error("You don't have permission to edit this post");
        navigate("/feed");
        return;
      }

      setTitle(data.title);
      setDescription(data.description);
      setCategory(data.category);
      setPrice(data.optional_price?.toString() || "");
      setDisplayPrice(data.optional_price ? formatNairaInput(data.optional_price.toString()) : "");
      setCurrentImageUrl(data.image_url);
    } catch (error: any) {
      toast.error("Failed to load post");
      navigate("/feed");
    } finally {
      setFetching(false);
    }
  };

  const handleImageSelect = (file: File) => {
    setSelectedImage(file);
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const formatted = formatNairaInput(rawValue);
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

      // Handle image changes
      if (selectedImage) {
        setUploading(true);
        // Delete old image if exists
        if (currentImageUrl) {
          await handleImageRemove();
        }
        const uploadResult = await uploadImage(selectedImage, 'post-images', 'posts');
        imageUrl = uploadResult.url;
        setUploading(false);
      }

      // Generate new AI summary
      const summaryResponse = await supabase.functions.invoke('generate-summary', {
        body: { description }
      });

      const { error } = await supabase
        .from('posts')
        .update({
          title,
          description,
          category: category as any,
          optional_price: price ? parseFloat(price) : null,
          ai_summary: summaryResponse.data?.summary || null,
          image_url: imageUrl
        })
        .eq('id', id);

      if (error) throw error;

      toast.success("Post updated successfully!");
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
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8 flex justify-center pt-20">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-2xl pt-20">
        <Card className="shadow-hover">
          <CardHeader>
            <CardTitle className="text-2xl">Edit Post</CardTitle>
            <CardDescription>Update your post information</CardDescription>
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
                  currentImage={currentImageUrl || undefined}
                  onImageRemove={handleImageRemove}
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
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate(`/post/${id}`)} 
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || uploading} className="flex-1">
                  {uploading ? "Uploading..." : loading ? "Updating..." : "Update Post"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditPost;
