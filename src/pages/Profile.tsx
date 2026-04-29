import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Star, Save, LogOut, Moon, Sun, LayoutDashboard, ChevronRight,
  UserPen, FileText, MessageSquare, Settings, ArrowLeft
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageUpload } from "@/components/ImageUpload";
import { uploadImage, deleteImage } from "@/lib/imageUpload";
import BottomNav from "@/components/BottomNav";
import { NotificationSettings } from "@/components/NotificationSettings";
import { Bell } from "lucide-react";

type Panel = 'edit' | 'reviews' | 'notifications' | 'settings' | null;

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [bio, setBio] = useState("");
  const [reviews, setReviews] = useState<any[]>([]);
  const [postCount, setPostCount] = useState(0);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [expanded, setExpanded] = useState<Panel>(null);
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    fetchProfile();
    fetchReviews();
    fetchStats();
    checkAdmin();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth"); return; }
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
    const { count } = await supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
    setPostCount(count || 0);
  };

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    setIsAdmin(!!data);
  };

  const handleImageSelect = (file: File) => setSelectedImage(file);

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
      toast.success("Profile updated!");
      fetchProfile();
      setSelectedImage(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    localStorage.setItem('theme', next);
    setIsDark(next === 'dark');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate('/auth');
  };

  const togglePanel = (panel: Panel) => setExpanded(prev => prev === panel ? null : panel);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop: keep global Navbar */}
      <div className="hidden lg:block">
        <Navbar />
      </div>

      {/* Mobile: slim header — title + gear (jumps to Settings panel) */}
      <header
        className="lg:hidden sticky top-0 z-30 bg-background/85 backdrop-blur-xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="h-12 px-3 flex items-center justify-between">
          <h1 className="text-[20px] font-bold tracking-tight">Profile</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => togglePanel('settings')}
            className="h-10 w-10 rounded-full hover:bg-muted text-foreground/80"
            aria-label="Settings"
          >
            <Settings className="h-[19px] w-[19px]" />
          </Button>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-5 pb-32 lg:pt-[88px] lg:pb-12">
        {/* Hero — centered avatar / name / course */}
        <section className="pt-6 pb-7 flex flex-col items-center text-center">
          <Avatar className="h-24 w-24 ring-4 ring-background shadow-md">
            <AvatarImage src={profile?.profile_picture || ""} className="object-cover" />
            <AvatarFallback className="text-2xl bg-gradient-primary text-primary-foreground font-bold">
              {name.charAt(0).toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-[22px] font-bold tracking-tight mt-4">{name || 'Your Name'}</h2>
          {course && <p className="text-sm text-muted-foreground mt-0.5">{course}</p>}
          {bio && <p className="text-[13px] text-muted-foreground/80 mt-2 max-w-xs leading-relaxed">{bio}</p>}
        </section>

        {/* Stats — Posts / Reviews / Rating (all real data) */}
        <section className="grid grid-cols-3 gap-2 pb-6 border-b border-border/40">
          <Stat value={postCount} label="Posts" />
          <Stat value={reviews.length} label="Reviews" divider />
          <Stat value={profile?.rating != null ? Number(profile.rating).toFixed(1) : '—'} label="Rating" />
        </section>

        {/* Menu list */}
        <section className="mt-5 rounded-2xl bg-card border border-border/40 overflow-hidden divide-y divide-border/40">
          <MenuRow
            icon={UserPen}
            label="Edit Profile"
            isOpen={expanded === 'edit'}
            onClick={() => togglePanel('edit')}
          />
          {expanded === 'edit' && (
            <div className="p-4 bg-muted/20">
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Profile photo</Label>
                  <ImageUpload
                    onImageSelect={handleImageSelect}
                    currentImage={profile?.profile_picture}
                    onImageRemove={handleImageRemove}
                    isUploading={uploading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-semibold text-foreground">Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="h-11 rounded-xl bg-background border-border/60" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="course" className="text-xs font-semibold text-foreground">Course / Department</Label>
                  <Input id="course" placeholder="e.g. Computer Science" value={course} onChange={(e) => setCourse(e.target.value)} className="h-11 rounded-xl bg-background border-border/60" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bio" className="text-xs font-semibold text-foreground">Bio</Label>
                  <Textarea id="bio" placeholder="Tell us about yourself..." value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="rounded-xl bg-background border-border/60 resize-none" />
                </div>
                <Button type="submit" disabled={loading || uploading} className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 font-semibold shadow-md shadow-primary/20">
                  {uploading ? "Uploading..." : loading ? "Saving..." : (
                    <span className="flex items-center gap-2"><Save className="h-4 w-4" /> Save changes</span>
                  )}
                </Button>
              </form>
            </div>
          )}

          <MenuRow icon={FileText} label="My Tasks" onClick={() => navigate('/my-tasks')} />

          <MenuRow
            icon={Star}
            label="Reviews"
            count={reviews.length}
            isOpen={expanded === 'reviews'}
            onClick={() => togglePanel('reviews')}
          />
          {expanded === 'reviews' && (
            <div className="p-4 bg-muted/20">
              {reviews.length === 0 ? (
                <div className="text-center py-6">
                  <Star className="h-7 w-7 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No reviews yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">Help others to earn your first review</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {reviews.slice(0, 8).map((review) => (
                    <li key={review.id} className="rounded-xl bg-background p-3 border border-border/40">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={review.profiles?.profile_picture || ""} />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                            {review.profiles?.name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm leading-tight truncate">{review.profiles?.name}</p>
                          <p className="text-[11px] text-muted-foreground leading-tight">{formatDate(review.created_at)}</p>
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`h-3 w-3 ${s <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-[13px] text-foreground/80 mt-2 leading-relaxed">{review.comment}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <MenuRow
            icon={Bell}
            label="Notifications"
            isOpen={expanded === 'notifications'}
            onClick={() => togglePanel('notifications')}
          />
          {expanded === 'notifications' && <NotificationSettings />}

          <MenuRow
            icon={Settings}
            label="Settings"
            isOpen={expanded === 'settings'}
            onClick={() => togglePanel('settings')}
          />
          {expanded === 'settings' && (
            <div className="bg-muted/20">
              <SubAction onClick={toggleTheme} icon={isDark ? Sun : Moon} label={isDark ? 'Light mode' : 'Dark mode'} />
              {isAdmin && (
                <SubAction onClick={() => navigate('/admin')} icon={LayoutDashboard} label="Admin dashboard" />
              )}
            </div>
          )}
        </section>

        {/* Log Out — own card, red text, matches mockup */}
        <button
          onClick={handleSignOut}
          className="w-full mt-4 flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-card border border-border/40 hover:bg-destructive/5 transition-colors text-destructive"
        >
          <LogOut className="h-[18px] w-[18px]" />
          <span className="flex-1 text-left text-sm font-semibold">Log Out</span>
        </button>
      </div>
      <BottomNav />
    </div>
  );
};

// ─── Subcomponents ───

const Stat = ({ value, label, divider }: { value: number | string; label: string; divider?: boolean }) => (
  <div className={`flex flex-col items-center justify-center py-1 ${divider ? 'border-x border-border/40' : ''}`}>
    <span className="text-[22px] font-bold tracking-tight text-foreground leading-none">{value}</span>
    <span className="text-[11px] text-muted-foreground mt-1.5 font-medium">{label}</span>
  </div>
);

const MenuRow = ({
  icon: Icon,
  label,
  count,
  isOpen,
  onClick,
}: {
  icon: typeof Settings;
  label: string;
  count?: number;
  isOpen?: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors text-left"
  >
    <Icon className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={1.8} />
    <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
    {count != null && count > 0 && (
      <span className="text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full font-semibold">
        {count}
      </span>
    )}
    <ChevronRight
      className={`h-4 w-4 text-muted-foreground/50 transition-transform ${isOpen ? 'rotate-90' : ''}`}
    />
  </button>
);

const SubAction = ({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Settings;
  label: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left border-t border-border/30 first:border-t-0"
  >
    <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
    <span className="flex-1 text-sm font-medium">{label}</span>
    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
  </button>
);

export default Profile;
