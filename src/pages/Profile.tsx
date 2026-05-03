import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Star,
  Save,
  LogOut,
  Moon,
  Sun,
  Monitor,
  LayoutDashboard,
  ChevronRight,
  UserPen,
  FileText,
  MessageSquare,
  Settings,
  Bell,
  Heart,
  Loader2,
  ShieldAlert,
  Info,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  Megaphone,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageUpload } from "@/components/ImageUpload";
import { uploadImage, deleteImage } from "@/lib/imageUpload";
import BottomNav from "@/components/BottomNav";
import { NotificationSettings } from "@/components/NotificationSettings";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { formatDistanceToNow } from "date-fns";

type ThemePref = "light" | "dark" | "system";
type Panel = "edit" | "reviews" | "notifications" | "account" | "about" | null;

type ActivityPost = {
  id: string;
  title: string;
  category: string;
  optional_price: number | null;
  due_date: string | null;
  status: string | null;
  created_at: string;
};

type LikedPost = ActivityPost & { liked_at: string };

type MyComment = {
  id: string;
  comment_text: string;
  created_at: string;
  post_id: string;
  post_title: string;
};

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [bio, setBio] = useState("");
  const [schoolId, setSchoolId] = useState<string>("");
  const [facultyId, setFacultyId] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [level, setLevel] = useState<string>("");
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [faculties, setFaculties] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [activePublisher, setActivePublisher] = useState<any>(null);
  const [pendingApplication, setPendingApplication] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [postCount, setPostCount] = useState(0);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState<Panel>(null);
  const [themePref, setThemePref] = useState<ThemePref>(() => {
    const stored = (typeof localStorage !== "undefined" &&
      localStorage.getItem("theme")) as ThemePref | null;
    return stored || "system";
  });

  // ─── Activity tab state ───
  const [activeTab, setActiveTab] = useState<"about" | "posts" | "likes" | "comments">("about");
  const [myPosts, setMyPosts] = useState<ActivityPost[] | null>(null);
  const [myLikes, setMyLikes] = useState<LikedPost[] | null>(null);
  const [myComments, setMyComments] = useState<MyComment[] | null>(null);
  const [tabLoading, setTabLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchReviews();
    fetchStats();
    checkAdmin();
  }, []);

  // Re-apply theme whenever the preference changes
  useEffect(() => {
    applyTheme(themePref);
    localStorage.setItem("theme", themePref);

    if (themePref === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => applyTheme("system");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
  }, [themePref]);

  // Lazy-fetch tab data when the user picks a tab
  useEffect(() => {
    if (activeTab === "posts" && myPosts === null) loadMyPosts();
    if (activeTab === "likes" && myLikes === null) loadMyLikes();
    if (activeTab === "comments" && myComments === null) loadMyComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (data) {
      setProfile(data);
      setName(data.name || "");
      setCourse(data.course || "");
      setBio(data.bio || "");
      setSchoolId(data.school_id || "");
      setFacultyId(data.faculty_id || "");
      setDepartmentId(data.department_id || "");
      setLevel(data.level ? String(data.level) : "");
    }

    // Load lookup tables for the academic dropdowns
    const { data: ss } = await supabase.from("schools").select("id, name").order("name");
    setSchools(ss || []);

    // Publisher state — drives the "Become a publisher" CTA copy
    const [{ data: pub }, { data: app }] = await Promise.all([
      supabase.from("publishers").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("publisher_applications").select("*")
        .eq("user_id", user.id).eq("status", "pending").maybeSingle(),
    ]);
    setActivePublisher(pub);
    setPendingApplication(app);
  };

  // Cascade: when school/faculty changes, reload children
  useEffect(() => {
    if (!schoolId) { setFaculties([]); return; }
    supabase.from("faculties").select("id, name").eq("school_id", schoolId).order("name")
      .then(({ data }) => setFaculties(data || []));
  }, [schoolId]);
  useEffect(() => {
    if (!facultyId) { setDepartments([]); return; }
    supabase.from("departments").select("id, name").eq("faculty_id", facultyId).order("name")
      .then(({ data }) => setDepartments(data || []));
  }, [facultyId]);

  const fetchReviews = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("reviews")
      .select(`*, profiles!reviews_reviewer_id_fkey (name, profile_picture)`)
      .eq("reviewed_user_id", user.id)
      .order("created_at", { ascending: false });
    setReviews(data || []);
  };

  const fetchStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { count } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    setPostCount(count || 0);
  };

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!data);
  };

  const loadMyPosts = async () => {
    setTabLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("posts")
      .select("id, title, category, optional_price, due_date, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setMyPosts((data as ActivityPost[]) || []);
    setTabLoading(false);
  };

  const loadMyLikes = async () => {
    setTabLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("post_likes")
      .select(
        `created_at, posts ( id, title, category, optional_price, due_date, status, created_at )`
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    const flat: LikedPost[] = (data || [])
      .filter((row: any) => row.posts)
      .map((row: any) => ({ ...(row.posts as ActivityPost), liked_at: row.created_at }));
    setMyLikes(flat);
    setTabLoading(false);
  };

  const loadMyComments = async () => {
    setTabLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("comments")
      .select(`id, comment_text, created_at, post_id, posts ( title )`)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    const flat: MyComment[] = (data || []).map((row: any) => ({
      id: row.id,
      comment_text: row.comment_text,
      created_at: row.created_at,
      post_id: row.post_id,
      post_title: row.posts?.title || "Post",
    }));
    setMyComments(flat);
    setTabLoading(false);
  };

  const handleImageSelect = (file: File) => setSelectedImage(file);

  const handleImageRemove = async () => {
    if (profile?.profile_picture) {
      try {
        const path = profile.profile_picture.split("/").slice(-2).join("/");
        await deleteImage("profile-pictures", path);
      } catch (error) {
        console.error("Error deleting old image:", error);
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
        const uploadResult = await uploadImage(selectedImage, "profile-pictures", "profile");
        profilePictureUrl = uploadResult.url;
        setUploading(false);
      }
      const { error } = await supabase
        .from("profiles")
        .update({
          name, course, bio,
          profile_picture: profilePictureUrl,
          school_id: schoolId || null,
          faculty_id: facultyId || null,
          department_id: departmentId || null,
          level: level ? parseInt(level, 10) : null,
        })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Profile updated!");
      fetchProfile();
      setSelectedImage(null);
      setSettingsPanel(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const applyTheme = (pref: ThemePref) => {
    if (pref === "system") {
      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", dark);
    } else {
      document.documentElement.classList.toggle("dark", pref === "dark");
    }
  };

  const handleSendPasswordReset = async () => {
    if (!profile?.email && !profile?.id) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("No email on file");
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success("Password reset email sent");
    } catch (e: any) {
      toast.error(e.message || "Couldn't send reset email");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate("/auth");
  };

  const openSettings = () => {
    setSettingsPanel(null);
    setSettingsOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop: keep global Navbar */}
      <div className="hidden lg:block">
        <Navbar />
      </div>

      {/* Mobile: slim header — title + gear */}
      <header
        className="lg:hidden sticky top-0 z-30 bg-background/85 backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="h-12 px-3 flex items-center justify-between">
          <h1 className="text-[20px] font-bold tracking-tight">Profile</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={openSettings}
            className="h-10 w-10 rounded-full hover:bg-muted text-foreground/80"
            aria-label="Settings"
          >
            <Settings className="h-[19px] w-[19px]" />
          </Button>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-5 pb-32 lg:pt-[88px] lg:pb-12">
        {/* Hero */}
        <section className="pt-6 pb-6 flex flex-col items-center text-center">
          <Avatar className="h-24 w-24 ring-4 ring-background shadow-md">
            <AvatarImage src={profile?.profile_picture || ""} className="object-cover" />
            <AvatarFallback className="text-2xl bg-gradient-primary text-primary-foreground font-bold">
              {name.charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-[22px] font-bold tracking-tight mt-4">{name || "Your Name"}</h2>
          {course && <p className="text-sm text-muted-foreground mt-0.5">{course}</p>}
          {bio && (
            <p className="text-[13px] text-muted-foreground/80 mt-2 max-w-xs leading-relaxed">
              {bio}
            </p>
          )}

          {/* Edit / Settings buttons (desktop) */}
          <div className="hidden lg:flex gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSettingsPanel("edit");
                setSettingsOpen(true);
              }}
              className="rounded-full text-xs font-semibold"
            >
              <UserPen className="h-3.5 w-3.5 mr-1.5" />
              Edit profile
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openSettings}
              className="rounded-full text-xs font-semibold"
            >
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              Settings
            </Button>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-3 gap-2 pb-5 border-b border-border/40">
          <Stat value={postCount} label="Posts" />
          <Stat value={reviews.length} label="Reviews" divider />
          <Stat
            value={profile?.rating != null ? Number(profile.rating).toFixed(1) : "—"}
            label="Rating"
          />
        </section>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="mt-5"
        >
          <TabsList className="w-full grid grid-cols-4 h-10 bg-muted/40 p-0.5 rounded-xl">
            <TabsTrigger value="about" className="text-xs rounded-lg">
              About
            </TabsTrigger>
            <TabsTrigger value="posts" className="text-xs rounded-lg">
              Posts
            </TabsTrigger>
            <TabsTrigger value="likes" className="text-xs rounded-lg">
              Likes
            </TabsTrigger>
            <TabsTrigger value="comments" className="text-xs rounded-lg">
              Comments
            </TabsTrigger>
          </TabsList>

          {/* ABOUT */}
          <TabsContent value="about" className="mt-4 space-y-3">
            {bio ? (
              <div className="rounded-2xl border border-border/40 bg-card p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Bio
                </h3>
                <p className="text-sm leading-relaxed">{bio}</p>
              </div>
            ) : (
              <EmptyHint
                icon={UserPen}
                title="No bio yet"
                hint="Add a few lines so people know who you are."
                action={() => {
                  setSettingsPanel("edit");
                  setSettingsOpen(true);
                }}
                actionLabel="Edit profile"
              />
            )}

            {/* Reviews preview */}
            <div className="rounded-2xl border border-border/40 bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Recent reviews
                </h3>
                <span className="text-xs font-semibold text-muted-foreground">
                  {reviews.length}
                </span>
              </div>
              {reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No reviews yet — help others to earn your first one.
                </p>
              ) : (
                <ul className="space-y-3">
                  {reviews.slice(0, 3).map((r) => (
                    <li key={r.id} className="flex items-start gap-2.5">
                      <Avatar className="h-8 w-8 mt-0.5">
                        <AvatarImage src={r.profiles?.profile_picture || ""} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                          {r.profiles?.name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold truncate">{r.profiles?.name}</p>
                          <div className="flex gap-0.5 flex-shrink-0">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`h-3 w-3 ${
                                  s <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        {r.comment && (
                          <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                            {r.comment}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          {/* POSTS */}
          <TabsContent value="posts" className="mt-4">
            {tabLoading && myPosts === null ? (
              <ListSkeleton />
            ) : myPosts && myPosts.length > 0 ? (
              <ul className="space-y-2.5">
                {myPosts.map((p) => (
                  <ActivityPostCard key={p.id} post={p} />
                ))}
              </ul>
            ) : (
              <EmptyHint
                icon={FileText}
                title="No posts yet"
                hint="Create your first task and people can offer to help."
                action={() => navigate("/create-post")}
                actionLabel="Create a post"
              />
            )}
          </TabsContent>

          {/* LIKES */}
          <TabsContent value="likes" className="mt-4">
            {tabLoading && myLikes === null ? (
              <ListSkeleton />
            ) : myLikes && myLikes.length > 0 ? (
              <ul className="space-y-2.5">
                {myLikes.map((p) => (
                  <ActivityPostCard
                    key={p.id}
                    post={p}
                    contextLabel={`Liked ${formatDistanceToNow(new Date(p.liked_at))} ago`}
                  />
                ))}
              </ul>
            ) : (
              <EmptyHint
                icon={Heart}
                title="No liked posts"
                hint="Tap the heart on a post and it'll show up here."
              />
            )}
          </TabsContent>

          {/* COMMENTS */}
          <TabsContent value="comments" className="mt-4">
            {tabLoading && myComments === null ? (
              <ListSkeleton />
            ) : myComments && myComments.length > 0 ? (
              <ul className="space-y-2.5">
                {myComments.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/post/${c.post_id}`}
                      className="block rounded-2xl bg-card border border-border/40 p-3.5 hover:border-primary/30 hover:shadow-sm transition-all"
                    >
                      <p className="text-xs text-muted-foreground mb-1.5 truncate">
                        On <span className="font-semibold text-foreground">{c.post_title}</span>
                      </p>
                      <p className="text-sm leading-relaxed line-clamp-3">{c.comment_text}</p>
                      <p className="text-[11px] text-muted-foreground/70 mt-2">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyHint
                icon={MessageSquare}
                title="No comments yet"
                hint="Comments you leave on posts will show up here."
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />

      {/* ─── Settings Sheet ─── */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md flex flex-col gap-0 p-0"
        >
          <SheetHeader className="px-5 py-4 border-b border-border/40 text-left">
            <SheetTitle>Settings</SheetTitle>
            <SheetDescription className="text-xs">
              Manage your profile, theme, notifications, and account.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto pb-8">
            {/* Edit profile */}
            <SettingsRow
              icon={UserPen}
              label="Edit profile"
              expanded={settingsPanel === "edit"}
              onClick={() => setSettingsPanel(settingsPanel === "edit" ? null : "edit")}
            />
            {settingsPanel === "edit" && (
              <div className="px-5 py-4 bg-muted/20 border-b border-border/40">
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Profile photo</Label>
                    <ImageUpload
                      onImageSelect={handleImageSelect}
                      currentImage={profile?.profile_picture}
                      onImageRemove={handleImageRemove}
                      isUploading={uploading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs font-semibold">
                      Name
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="course" className="text-xs font-semibold">
                      Course / Department
                    </Label>
                    <Input
                      id="course"
                      placeholder="e.g. Computer Science"
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bio" className="text-xs font-semibold">
                      Bio
                    </Label>
                    <Textarea
                      id="bio"
                      placeholder="Tell us about yourself..."
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      className="rounded-xl resize-none"
                    />
                  </div>

                  {/* Academic identity — required for memos to be filtered properly */}
                  <div className="pt-2 border-t border-border/40">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Academic
                    </p>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">School</Label>
                        <Select value={schoolId} onValueChange={(v) => { setSchoolId(v); setFacultyId(""); setDepartmentId(""); }}>
                          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Pick your school" /></SelectTrigger>
                          <SelectContent>
                            {schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Faculty</Label>
                        <Select value={facultyId} onValueChange={(v) => { setFacultyId(v); setDepartmentId(""); }} disabled={!schoolId}>
                          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Pick a faculty" /></SelectTrigger>
                          <SelectContent>
                            {faculties.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Department</Label>
                        <Select value={departmentId} onValueChange={setDepartmentId} disabled={!facultyId}>
                          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Pick a department" /></SelectTrigger>
                          <SelectContent>
                            {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Level</Label>
                        <Select value={level} onValueChange={setLevel}>
                          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Pick your level" /></SelectTrigger>
                          <SelectContent>
                            {[100, 200, 300, 400, 500, 600].map((l) => (
                              <SelectItem key={l} value={String(l)}>{l} Level</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={loading || uploading}
                    className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 font-semibold"
                  >
                    {uploading || loading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {uploading ? "Uploading..." : "Saving..."}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Save className="h-4 w-4" /> Save changes
                      </span>
                    )}
                  </Button>
                </form>
              </div>
            )}

            {/* Reviews */}
            <SettingsRow
              icon={Star}
              label="Reviews"
              count={reviews.length}
              expanded={settingsPanel === "reviews"}
              onClick={() =>
                setSettingsPanel(settingsPanel === "reviews" ? null : "reviews")
              }
            />
            {settingsPanel === "reviews" && (
              <div className="px-5 py-4 bg-muted/20 border-b border-border/40">
                {reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center">
                    No reviews yet
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {reviews.map((r) => (
                      <li
                        key={r.id}
                        className="rounded-xl bg-background border border-border/40 p-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={r.profiles?.profile_picture || ""} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                              {r.profiles?.name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{r.profiles?.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`h-3 w-3 ${
                                  s <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        {r.comment && (
                          <p className="text-[13px] mt-2 leading-relaxed text-foreground/80">
                            {r.comment}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Publisher status / apply */}
            {activePublisher?.status === "active" ? (
              <SettingsRow
                icon={ShieldCheck}
                label="Verified publisher"
                onClick={() => navigate("/memos/new")}
              />
            ) : pendingApplication ? (
              <SettingsRow
                icon={ShieldCheck}
                label="Application under review"
                onClick={() => {}}
              />
            ) : (
              <SettingsRow
                icon={Megaphone}
                label="Become a publisher"
                onClick={() => {
                  setSettingsOpen(false);
                  navigate("/apply-publisher");
                }}
              />
            )}

            {/* Notifications */}
            <SettingsRow
              icon={Bell}
              label="Notifications"
              expanded={settingsPanel === "notifications"}
              onClick={() =>
                setSettingsPanel(settingsPanel === "notifications" ? null : "notifications")
              }
            />
            {settingsPanel === "notifications" && (
              <div className="bg-muted/20 border-b border-border/40">
                <NotificationSettings />
              </div>
            )}

            {/* Theme — section heading */}
            <div className="px-5 pt-5 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Display
            </div>
            <div className="px-5 pb-3">
              <div className="grid grid-cols-3 gap-2">
                <ThemeOption
                  active={themePref === "light"}
                  icon={Sun}
                  label="Light"
                  onClick={() => setThemePref("light")}
                />
                <ThemeOption
                  active={themePref === "dark"}
                  icon={Moon}
                  label="Dark"
                  onClick={() => setThemePref("dark")}
                />
                <ThemeOption
                  active={themePref === "system"}
                  icon={Monitor}
                  label="System"
                  onClick={() => setThemePref("system")}
                />
              </div>
            </div>

            <div className="border-t border-border/40 mt-2" />

            {/* Account */}
            <SettingsRow
              icon={KeyRound}
              label="Account"
              expanded={settingsPanel === "account"}
              onClick={() =>
                setSettingsPanel(settingsPanel === "account" ? null : "account")
              }
            />
            {settingsPanel === "account" && (
              <div className="bg-muted/20 border-b border-border/40">
                <SubAction
                  icon={KeyRound}
                  label="Change password"
                  onClick={handleSendPasswordReset}
                />
                <SubAction
                  icon={LogOut}
                  label="Sign out"
                  onClick={handleSignOut}
                  destructive
                />
              </div>
            )}

            {/* About */}
            <SettingsRow
              icon={Info}
              label="About"
              expanded={settingsPanel === "about"}
              onClick={() => setSettingsPanel(settingsPanel === "about" ? null : "about")}
            />
            {settingsPanel === "about" && (
              <div className="bg-muted/20 border-b border-border/40">
                <SubAction
                  icon={ShieldAlert}
                  label="Privacy policy"
                  onClick={() => window.open("/privacy", "_blank")}
                  trailing={<ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60" />}
                />
                <SubAction
                  icon={FileText}
                  label="Terms of service"
                  onClick={() => window.open("/terms", "_blank")}
                  trailing={<ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60" />}
                />
                <div className="px-5 py-3 text-[11px] text-muted-foreground/70 border-t border-border/30">
                  CampusLink • v1.0.0
                </div>
              </div>
            )}

            {isAdmin && (
              <SettingsRow
                icon={LayoutDashboard}
                label="Admin dashboard"
                onClick={() => {
                  setSettingsOpen(false);
                  navigate("/admin");
                }}
              />
            )}

            {/* Sign out — quick action */}
            <button
              onClick={handleSignOut}
              className="w-full mx-5 mt-4 mb-4 flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-card border border-border/40 hover:bg-destructive/5 transition-colors text-destructive"
              style={{ width: "calc(100% - 2.5rem)" }}
            >
              <LogOut className="h-[18px] w-[18px]" />
              <span className="flex-1 text-left text-sm font-semibold">Log Out</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

/* ─── Subcomponents ─── */

const Stat = ({
  value,
  label,
  divider,
}: {
  value: number | string;
  label: string;
  divider?: boolean;
}) => (
  <div className={`flex flex-col items-center justify-center py-1 ${divider ? "border-x border-border/40" : ""}`}>
    <span className="text-[22px] font-bold tracking-tight leading-none">{value}</span>
    <span className="text-[11px] text-muted-foreground mt-1.5 font-medium">{label}</span>
  </div>
);

const ListSkeleton = () => (
  <div className="space-y-2.5">
    {[1, 2, 3].map((i) => (
      <div key={i} className="h-20 rounded-2xl bg-muted/40 animate-pulse" />
    ))}
  </div>
);

const EmptyHint = ({
  icon: Icon,
  title,
  hint,
  action,
  actionLabel,
}: {
  icon: typeof FileText;
  title: string;
  hint: string;
  action?: () => void;
  actionLabel?: string;
}) => (
  <div className="rounded-2xl border border-border/40 bg-card p-8 text-center">
    <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
      <Icon className="h-5 w-5 text-muted-foreground/50" />
    </div>
    <p className="font-semibold text-sm mb-1">{title}</p>
    <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{hint}</p>
    {action && actionLabel && (
      <Button onClick={action} size="sm" className="rounded-full text-xs font-semibold">
        {actionLabel}
      </Button>
    )}
  </div>
);

const ActivityPostCard = ({
  post,
  contextLabel,
}: {
  post: ActivityPost;
  contextLabel?: string;
}) => (
  <li>
    <Link
      to={`/post/${post.id}`}
      className="block rounded-2xl bg-card border border-border/40 p-3.5 hover:border-primary/30 hover:shadow-sm transition-all"
    >
      {contextLabel && (
        <p className="text-[11px] font-medium text-muted-foreground/80 mb-1.5">
          {contextLabel}
        </p>
      )}
      <h4 className="font-bold text-sm leading-snug truncate">{post.title}</h4>
      <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold text-[10px]">
          {post.category}
        </span>
        {post.optional_price != null && (
          <span className="font-semibold">₦{Number(post.optional_price).toLocaleString()}</span>
        )}
        {post.status && post.status !== "open" && (
          <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60">
            {post.status.replace("_", " ")}
          </span>
        )}
      </div>
    </Link>
  </li>
);

const SettingsRow = ({
  icon: Icon,
  label,
  count,
  expanded,
  onClick,
}: {
  icon: typeof Settings;
  label: string;
  count?: number;
  expanded?: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors text-left border-b border-border/30"
  >
    <Icon className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={1.8} />
    <span className="flex-1 text-sm font-medium">{label}</span>
    {count != null && count > 0 && (
      <span className="text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full font-semibold">
        {count}
      </span>
    )}
    <ChevronRight
      className={`h-4 w-4 text-muted-foreground/50 transition-transform ${expanded ? "rotate-90" : ""}`}
    />
  </button>
);

const SubAction = ({
  icon: Icon,
  label,
  onClick,
  destructive = false,
  trailing,
}: {
  icon: typeof Settings;
  label: string;
  onClick: () => void;
  destructive?: boolean;
  trailing?: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors text-left border-t border-border/30 first:border-t-0 ${
      destructive ? "text-destructive" : ""
    }`}
  >
    <Icon className="h-4 w-4" strokeWidth={1.8} />
    <span className="flex-1 text-sm font-medium">{label}</span>
    {trailing || <ChevronRight className="h-4 w-4 text-muted-foreground/40" />}
  </button>
);

const ThemeOption = ({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Sun;
  label: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-colors ${
      active
        ? "bg-primary/10 border-primary/30 text-primary"
        : "bg-card border-border/40 hover:bg-muted/40 text-foreground"
    }`}
  >
    <Icon className="h-4 w-4" strokeWidth={1.8} />
    <span className="text-[11px] font-semibold">{label}</span>
  </button>
);

export default Profile;
