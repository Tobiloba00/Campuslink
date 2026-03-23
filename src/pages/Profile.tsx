import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Star, Award, BookOpen, MessageSquare, TrendingUp, Camera, Save } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageUpload } from "@/components/ImageUpload";
import { uploadImage, deleteImage } from "@/lib/imageUpload";
import BottomNav from "@/components/BottomNav";

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [bio, setBio] = useState("");
  const [reviews, setReviews] = useState<any[]>([]);
  const [postCount, setPostCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchReviews();
    fetchStats();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) {
      setProfile(data);
      setName(data.name || "");
      setCourse(data.course || "");
      setBio(data.bio || "");
    }
  };

  const fetchReviews = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('reviews')
      .select(`*, profiles!reviews_reviewer_id_fkey (name, profile_picture)`)
      .eq('reviewed_user_id', user.id)
      .order('created_at', { ascending: false });
    setReviews(data || []);
  };

  const fetchStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [posts, messages] = await Promise.all([
      supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('sender_id', user.id),
    ]);
    setPostCount(posts.count || 0);
    setMessageCount(messages.count || 0);
  };

  const handleImageSelect = (file: File) => {
    setSelectedImage(file);
  };

  const handleImageRemove = async () => {
    if (profile?.profile_picture) {
      try {
        const path = profile.profile_picture.split('/').slice(-2).join('/');
        await deleteImage('profile-pictures', path);
      } catch (error) {
        console.error('Error deleting old image:', error);
      }
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      let profilePictureUrl = profile?.profile_picture;
      if (selectedImage) {
        setUploading(true);
        if (profilePictureUrl) await handleImageRemove();
        const uploadResult = await uploadImage(selectedImage, 'profile-pictures', 'profile');
        profilePictureUrl = uploadResult.url;
        setUploading(false);
      }
      const { error } = await supabase
        .from('profiles')
        .update({ name, course, bio, profile_picture: profilePictureUrl })
        .eq('id', user.id);
      if (error) throw error;
      toast.success("Profile updated successfully!");
      fetchProfile();
      setSelectedImage(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <div className="relative pt-14">
        {/* Cover gradient */}
        <div className="h-36 sm:h-44 bg-gradient-to-br from-primary via-primary/80 to-accent/60 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1)_0%,transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.05)_0%,transparent_50%)]" />
        </div>

        {/* Profile info overlay */}
        <div className="max-w-4xl mx-auto px-4 -mt-16 sm:-mt-20 relative z-10 mb-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6">
            <div className="relative group">
              <Avatar className="h-28 w-28 sm:h-32 sm:w-32 ring-4 ring-background shadow-2xl">
                <AvatarImage src={profile?.profile_picture || ""} />
                <AvatarFallback className="text-3xl bg-gradient-primary text-primary-foreground font-bold">
                  {name.charAt(0).toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            <div className="text-center sm:text-left pb-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{name || 'Your Name'}</h1>
              {course && <p className="text-muted-foreground text-sm mt-0.5">{course}</p>}
              {bio && <p className="text-muted-foreground text-sm mt-1 max-w-md">{bio}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="max-w-4xl mx-auto px-4 mb-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'Rating', value: profile?.rating?.toFixed(1) || '0.0', icon: Star, color: 'text-amber-500' },
            { label: 'Reviews', value: reviews.length, icon: Award, color: 'text-accent' },
            { label: 'Posts', value: postCount, icon: BookOpen, color: 'text-primary' },
            { label: 'Messages', value: messageCount, icon: MessageSquare, color: 'text-emerald-500' },
          ].map((stat, i) => (
            <div key={i} className="glass-panel p-3 sm:p-4 text-center border-white/10">
              <stat.icon className={`h-4 w-4 mx-auto mb-1.5 ${stat.color}`} />
              <div className="text-xl sm:text-2xl font-extrabold tracking-tight">{stat.value}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 pb-24 lg:pb-8">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Edit Form */}
          <Card className="glass-panel border-white/10">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                Edit Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Profile Picture</Label>
                  <ImageUpload
                    onImageSelect={handleImageSelect}
                    currentImage={profile?.profile_picture}
                    onImageRemove={handleImageRemove}
                    isUploading={uploading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-11 rounded-xl bg-muted/50 border-border/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="course" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Course / Major</Label>
                  <Input
                    id="course"
                    placeholder="e.g., Computer Science"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    className="h-11 rounded-xl bg-muted/50 border-border/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bio</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell us about yourself..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    className="rounded-xl bg-muted/50 border-border/50 resize-none"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading || uploading}
                  className="w-full h-11 rounded-xl bg-gradient-primary shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-[1.01] active:scale-[0.99] font-semibold"
                >
                  {uploading ? "Uploading..." : loading ? "Saving..." : (
                    <span className="flex items-center gap-2"><Save className="h-4 w-4" /> Save Changes</span>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Reviews */}
          <div className="space-y-6">
            {/* Rating Card */}
            <Card className="glass-panel border-white/10 overflow-hidden">
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-6">
                <div className="flex items-center gap-4">
                  <div className="text-5xl font-black tracking-tight text-amber-500">
                    {profile?.rating?.toFixed(1) || "0.0"}
                  </div>
                  <div>
                    <div className="flex gap-0.5 mb-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-5 w-5 ${
                            star <= (profile?.rating || 0)
                              ? "fill-amber-400 text-amber-400"
                              : "text-amber-200 dark:text-amber-900"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Based on {reviews.length} review{reviews.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Reviews List */}
            <Card className="glass-panel border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold">Recent Reviews</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {reviews.length === 0 ? (
                  <div className="text-center py-8">
                    <Star className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No reviews yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Help others to get your first review!</p>
                  </div>
                ) : (
                  reviews.slice(0, 5).map((review) => (
                    <div key={review.id} className="group p-3 rounded-xl hover:bg-muted/30 transition-colors -mx-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={review.profiles?.profile_picture || ""} />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                            {review.profiles?.name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-sm">{review.profiles?.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">{formatDate(review.created_at)}</span>
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-3 w-3 ${
                                star <= review.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-muted"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground leading-relaxed pl-11">{review.comment}</p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Profile;
