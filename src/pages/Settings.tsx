import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageUpload } from "@/components/ImageUpload";
import { uploadImage, deleteImage } from "@/lib/imageUpload";
import { NotificationSettings } from "@/components/NotificationSettings";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronRight, UserPen, Star, ShieldCheck, ClipboardCheck,
  Bell, Sun, Moon, Monitor, KeyRound, Lock, Info, FileText, ExternalLink,
  Loader2, LogOut, Save, Megaphone, AlertCircle, Eye, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

type ThemePref = "light" | "dark" | "system";
type SectionKey =
  | "edit_profile" | "reviews"
  | "become_publisher" | "publisher_status"
  | "notifications" | "appearance"
  | "account" | "security"
  | "about";

type NavItem = { key: SectionKey; label: string; icon: any; hidden?: boolean };

const Settings = () => {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [me, setMe] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [activePub, setActivePub] = useState<any>(null);
  const [pendingApp, setPendingApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Active section. Default to a sensible landing.
  const initial = (search.get("section") as SectionKey) || "edit_profile";
  const [section, setSection] = useState<SectionKey>(initial);

  // Mobile: when a section is open, show only the detail view
  const [mobileDetail, setMobileDetail] = useState<SectionKey | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      setMe(user);

      const [{ data: prof }, { data: revs }, { data: pub }, { data: app }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("reviews")
          .select("*, profiles!reviews_reviewer_id_fkey (name, profile_picture)")
          .eq("reviewed_user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("publishers").select("*, schools:school_id (name)")
          .eq("user_id", user.id).maybeSingle(),
        supabase.from("publisher_applications")
          .select("*, schools:school_id (name)")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setProfile(prof);
      setReviews(revs || []);
      setActivePub(pub);
      setPendingApp(app);

      // If we landed with no explicit section and the user has a publisher
      // application, default to the publisher_status section.
      if (!search.get("section") && (pub || (app && app.status !== "rejected"))) {
        setSection("publisher_status");
      }

      setLoading(false);
    })();
  }, [navigate, search]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate("/auth");
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const hasPublisherEntry = !!activePub || !!pendingApp;

  // The full nav list — we'll partition it into groups for rendering.
  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: "Profile",
      items: [
        { key: "edit_profile", label: "Edit Profile", icon: UserPen },
        { key: "reviews",      label: "Reviews",      icon: Star },
      ],
    },
    {
      label: "Publisher",
      items: [
        ...(!hasPublisherEntry ? [{ key: "become_publisher" as SectionKey, label: "Become a Publisher", icon: Megaphone }] : []),
        ...(hasPublisherEntry ? [{ key: "publisher_status" as SectionKey, label: "Publisher Status", icon: ShieldCheck }] : []),
      ],
    },
    {
      label: "Preferences",
      items: [
        { key: "notifications", label: "Notifications", icon: Bell },
        { key: "appearance",    label: "Appearance",    icon: Sun },
      ],
    },
    {
      label: "Account",
      items: [
        { key: "account",  label: "Account",  icon: KeyRound },
        { key: "security", label: "Security", icon: Lock },
      ],
    },
    {
      label: "Other",
      items: [
        { key: "about", label: "About CampusLink", icon: Info },
      ],
    },
  ];

  const onSectionPick = (key: SectionKey) => {
    setSection(key);
    setMobileDetail(key);
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="hidden lg:block"><Navbar /></div>

      {/* ────── Mobile master/detail ────── */}
      <div className="lg:hidden">
        {mobileDetail ? (
          <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border/40"
                    style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
              <div className="h-12 px-2 grid grid-cols-[auto_1fr_auto] items-center">
                <Button variant="ghost" size="icon" onClick={() => setMobileDetail(null)}
                        className="h-10 w-10 rounded-full" aria-label="Back">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-[16px] font-bold text-center truncate">{labelFor(mobileDetail, groups)}</h1>
                <div className="w-10" />
              </div>
            </header>
            <main className="px-4 pt-4 pb-32">
              <SectionContent
                section={mobileDetail} profile={profile} me={me} reviews={reviews}
                activePub={activePub} pendingApp={pendingApp}
                onProfileUpdated={(p) => setProfile(p)}
                onSignOut={handleSignOut} navigate={navigate}
              />
            </main>
          </div>
        ) : (
          <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border/40"
                    style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
              <div className="h-12 px-2 grid grid-cols-[auto_1fr_auto] items-center">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}
                        className="h-10 w-10 rounded-full" aria-label="Back">
                  <X className="h-5 w-5" />
                </Button>
                <h1 className="text-[16px] font-bold text-center">Settings</h1>
                <div className="w-10" />
              </div>
            </header>
            <main className="px-4 pt-4 pb-32">
              <NavList groups={groups} active={section} onPick={onSectionPick} />
              <Button variant="outline" onClick={handleSignOut}
                      className="w-full mt-6 rounded-xl h-12 text-destructive border-destructive/30 hover:bg-destructive/5 font-semibold">
                <LogOut className="h-4 w-4 mr-2" />Log Out
              </Button>
            </main>
            <BottomNav />
          </div>
        )}
      </div>

      {/* ────── Desktop two-pane ────── */}
      <div className="hidden lg:block">
        <div className="container mx-auto max-w-6xl px-4 pt-[5.5rem] pb-12">
          <h1 className="text-3xl font-bold tracking-tight mb-6">Settings</h1>
          <div className="grid grid-cols-[280px_1fr] gap-6">
            <aside className="bg-card border border-border/40 rounded-2xl p-3 sticky top-[5.5rem] self-start">
              <NavList groups={groups} active={section} onPick={onSectionPick} compact />
              <div className="border-t border-border/40 mt-3 pt-3">
                <button onClick={handleSignOut}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-destructive hover:bg-destructive/5">
                  <LogOut className="h-4 w-4" />Log Out
                </button>
              </div>
            </aside>
            <main>
              <div className="bg-card border border-border/40 rounded-2xl p-6 min-h-[400px]">
                <SectionContent
                  section={section} profile={profile} me={me} reviews={reviews}
                  activePub={activePub} pendingApp={pendingApp}
                  onProfileUpdated={(p) => setProfile(p)}
                  onSignOut={handleSignOut} navigate={navigate}
                />
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

const labelFor = (key: SectionKey, groups: any[]): string => {
  for (const g of groups) {
    for (const it of g.items) if (it.key === key) return it.label;
  }
  return "Settings";
};

/* ─── Nav list (used on both desktop sidebar and mobile master view) ─── */
const NavList = ({
  groups, active, onPick, compact = false,
}: {
  groups: { label: string; items: NavItem[] }[];
  active: SectionKey;
  onPick: (k: SectionKey) => void;
  compact?: boolean;
}) => (
  <div className="space-y-3">
    {groups.map((g, gi) => (
      g.items.length > 0 && (
        <div key={gi}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 px-3 mb-1.5">
            {g.label}
          </p>
          <div className={cn(compact ? "space-y-0" : "rounded-2xl bg-card border border-border/40 divide-y divide-border/40 overflow-hidden")}>
            {g.items.map((it) => {
              const Icon = it.icon;
              const isActive = active === it.key;
              return (
                <button key={it.key} onClick={() => onPick(it.key)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors text-sm",
                          compact ? cn("rounded-xl", isActive ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted/50 text-foreground")
                                  : "hover:bg-muted/40"
                        )}>
                  <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="flex-1">{it.label}</span>
                  {!compact && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
                </button>
              );
            })}
          </div>
        </div>
      )
    ))}
  </div>
);

/* ─── Section content — what renders in the right pane ─── */
const SectionContent = ({
  section, profile, me, reviews, activePub, pendingApp,
  onProfileUpdated, onSignOut, navigate,
}: any) => {
  switch (section) {
    case "edit_profile":     return <EditProfileSection profile={profile} onSaved={onProfileUpdated} />;
    case "reviews":          return <ReviewsSection reviews={reviews} />;
    case "become_publisher": return <BecomePublisherSection navigate={navigate} />;
    case "publisher_status": return <PublisherStatusSection activePub={activePub} pendingApp={pendingApp} navigate={navigate} />;
    case "notifications":    return <NotificationSettings />;
    case "appearance":       return <AppearanceSection />;
    case "account":          return <AccountSection me={me} />;
    case "security":         return <SecuritySection />;
    case "about":            return <AboutSection />;
    default:                 return null;
  }
};

/* ─── Sections ─── */
const EditProfileSection = ({ profile, onSaved }: any) => {
  const [name, setName] = useState(profile?.name || "");
  const [course, setCourse] = useState(profile?.course || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      let pic = profile?.profile_picture;
      if (selectedImage) {
        setUploading(true);
        if (pic) {
          try {
            const path = pic.split("/").slice(-2).join("/");
            await deleteImage("profile-pictures", path);
          } catch { /* tolerate orphan */ }
        }
        const result = await uploadImage(selectedImage, "profile-pictures", "profile");
        pic = result.url;
        setUploading(false);
      }
      const { error } = await supabase.from("profiles")
        .update({ name, course, bio, profile_picture: pic })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Profile updated");
      onSaved({ ...profile, name, course, bio, profile_picture: pic });
      setSelectedImage(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally { setSaving(false); setUploading(false); }
  };

  return (
    <>
      <SectionHeader title="Edit Profile" subtitle="Update how others see you on CampusLink." />
      <form onSubmit={handleSave} className="space-y-4 max-w-xl">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Profile photo</Label>
          <ImageUpload
            onImageSelect={setSelectedImage}
            currentImage={profile?.profile_picture}
            isUploading={uploading}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required className="h-11 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Course / Department</Label>
          <Input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g. Computer Science"
                 className="h-11 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Bio</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
                    placeholder="Tell us about yourself…" className="rounded-xl resize-none" />
        </div>
        <Button type="submit" disabled={saving || uploading}
                className="rounded-xl h-11 px-5 font-semibold bg-primary hover:bg-primary/90">
          {saving || uploading ? <Loader2 className="h-4 w-4 animate-spin" />
                               : <><Save className="h-4 w-4 mr-1.5" />Save changes</>}
        </Button>
      </form>
    </>
  );
};

const ReviewsSection = ({ reviews }: any) => (
  <>
    <SectionHeader title="Reviews" subtitle={`${reviews.length} ${reviews.length === 1 ? "review" : "reviews"} from peers.`} />
    {reviews.length === 0 ? (
      <EmptyState icon={Star} title="No reviews yet"
                  hint="Help others on tasks and they'll review you here." />
    ) : (
      <ul className="space-y-3 max-w-xl">
        {reviews.map((r: any) => (
          <li key={r.id} className="rounded-xl border border-border/40 p-3">
            <div className="flex items-start gap-2.5">
              <Avatar className="h-9 w-9">
                <AvatarImage src={r.profiles?.profile_picture || ""} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {r.profiles?.name?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-sm truncate">{r.profiles?.name}</p>
                  <div className="flex gap-0.5 flex-shrink-0">
                    {[1,2,3,4,5].map((s) => (
                      <Star key={s} className={`h-3 w-3 ${s <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {format(new Date(r.created_at), "MMM d, yyyy")}
                </p>
                {r.comment && <p className="text-sm mt-1.5 leading-relaxed">{r.comment}</p>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    )}
  </>
);

const BecomePublisherSection = ({ navigate }: any) => (
  <>
    <SectionHeader title="Become a Publisher" subtitle="Apply or manage your publisher access." />
    <div className="rounded-2xl border border-border/40 p-5 max-w-xl">
      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Megaphone className="h-6 w-6 text-primary" />
      </div>
      <p className="text-sm font-bold mb-1.5">Verified publishers post official memos</p>
      <p className="text-xs text-muted-foreground leading-relaxed mb-4">
        Student Unions and School Admins can apply for publisher access to broadcast memos to their school, faculty, or department.
      </p>
      <Button onClick={() => navigate("/apply-publisher")}
              className="rounded-xl h-11 px-5 font-semibold bg-primary hover:bg-primary/90">
        Start application<ChevronRight className="h-4 w-4 ml-0.5" />
      </Button>
    </div>
  </>
);

const PublisherStatusSection = ({ activePub, pendingApp, navigate }: any) => {
  const isActive = activePub?.status === "active";
  const isPending = !isActive && pendingApp?.status === "pending";
  const isRejected = pendingApp?.status === "rejected";

  return (
    <>
      <SectionHeader title="Become a Publisher" subtitle="Apply or manage your publisher access." />

      {/* Status banner */}
      {isActive && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 mb-5 flex items-center gap-3 max-w-2xl">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Verified Publisher</p>
            <p className="text-[11px] text-muted-foreground">
              Active since {format(new Date(activePub.verified_at), "MMM d, yyyy")}
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700">
            Verified
          </span>
        </div>
      )}

      {isPending && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 mb-5 flex items-center gap-3 max-w-2xl">
          <div className="h-9 w-9 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Application Pending</p>
            <p className="text-[11px] text-muted-foreground">
              Your application is under review. You'll be notified once there's an update.
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 flex-shrink-0">
            Pending
          </span>
        </div>
      )}

      {isRejected && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 mb-5 max-w-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-xl bg-red-500/15 text-red-700 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold">Application not approved</p>
              <p className="text-[11px] text-muted-foreground">
                Submitted {formatDistanceToNow(new Date(pendingApp.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          {pendingApp.rejection_reason && (
            <p className="text-xs text-muted-foreground bg-card rounded-lg p-3 border border-border/40">
              {pendingApp.rejection_reason}
            </p>
          )}
        </div>
      )}

      {/* Application details */}
      {(activePub || pendingApp) && (
        <div className="bg-card border border-border/40 rounded-2xl p-5 max-w-2xl">
          <p className="text-sm font-bold mb-3">Application Details</p>
          <dl className="space-y-2.5 text-sm">
            <DetailRow icon={ShieldCheck} label="Role">
              {(activePub?.role || pendingApp?.requested_role) === "student_union" ? "Student Union" : "School Admin"}
            </DetailRow>
            <DetailRow icon={Eye} label="Scope">
              {scopeLabel(activePub?.scope || pendingApp?.requested_scope)}
            </DetailRow>
            <DetailRow icon={Megaphone} label="School">
              {activePub?.schools?.name || pendingApp?.schools?.name || "—"}
            </DetailRow>
            {pendingApp?.proof_email && <DetailRow icon={null} label="Submitted Email">{pendingApp.proof_email}</DetailRow>}
            {pendingApp?.proof_whatsapp_link && <DetailRow icon={null} label="WhatsApp Link">
              <a href={pendingApp.proof_whatsapp_link} target="_blank" rel="noreferrer"
                 className="text-primary hover:underline truncate inline-block max-w-[200px]">
                {pendingApp.proof_whatsapp_link}
              </a>
            </DetailRow>}
            {pendingApp?.proof_reference_name && <DetailRow icon={null} label="Known Executive">{pendingApp.proof_reference_name}</DetailRow>}
          </dl>

          {isActive && (
            <Button onClick={() => navigate("/memos/new")}
                    className="mt-5 rounded-xl h-11 px-5 font-semibold bg-primary hover:bg-primary/90">
              Compose memo<ChevronRight className="h-4 w-4 ml-0.5" />
            </Button>
          )}

          {isRejected && (
            <Button onClick={() => navigate("/apply-publisher")}
                    className="mt-5 rounded-xl h-11 px-5 font-semibold bg-primary hover:bg-primary/90">
              Reapply
            </Button>
          )}
        </div>
      )}
    </>
  );
};

const AppearanceSection = () => {
  const [pref, setPref] = useState<ThemePref>(() => {
    const stored = (typeof localStorage !== "undefined" && localStorage.getItem("theme")) as ThemePref | null;
    return stored || "system";
  });

  useEffect(() => {
    const apply = (p: ThemePref) => {
      if (p === "system") {
        const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.classList.toggle("dark", dark);
      } else {
        document.documentElement.classList.toggle("dark", p === "dark");
      }
    };
    apply(pref);
    localStorage.setItem("theme", pref);
    if (pref === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => apply("system");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
  }, [pref]);

  return (
    <>
      <SectionHeader title="Appearance" subtitle="Choose how CampusLink looks on this device." />
      <div className="grid grid-cols-3 gap-2 max-w-md">
        <ThemeOpt active={pref === "light"}  icon={Sun}     label="Light"  onClick={() => setPref("light")} />
        <ThemeOpt active={pref === "dark"}   icon={Moon}    label="Dark"   onClick={() => setPref("dark")} />
        <ThemeOpt active={pref === "system"} icon={Monitor} label="System" onClick={() => setPref("system")} />
      </div>
    </>
  );
};

const AccountSection = ({ me }: any) => {
  const [busy, setBusy] = useState(false);
  const sendReset = async () => {
    if (!me?.email) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(me.email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password reset link sent to your email");
  };

  return (
    <>
      <SectionHeader title="Account" subtitle="Manage your sign-in details." />
      <div className="space-y-3 max-w-xl">
        <FieldDisplay label="Email">{me?.email}</FieldDisplay>
        <ActionRow icon={KeyRound} label="Change password"
                   hint="We'll send a secure reset link to your email."
                   onClick={sendReset} loading={busy} />
      </div>
    </>
  );
};

const SecuritySection = () => (
  <>
    <SectionHeader title="Security" subtitle="Account protection options." />
    <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
      Two-factor authentication and active session management are coming soon. For now, your account is protected by email-based OTP verification at signup.
    </p>
  </>
);

const AboutSection = () => (
  <>
    <SectionHeader title="About CampusLink" subtitle="Version, terms, and platform info." />
    <div className="space-y-3 max-w-xl">
      <ActionRow icon={FileText} label="Terms of service" external onClick={() => window.open("/terms", "_blank")} />
      <ActionRow icon={Lock}     label="Privacy policy"  external onClick={() => window.open("/privacy", "_blank")} />
      <FieldDisplay label="Version">CampusLink • v1.0.0</FieldDisplay>
    </div>
  </>
);

/* ─── Tiny helpers ─── */
const SectionHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="mb-5">
    <h2 className="text-xl font-bold tracking-tight">{title}</h2>
    <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
  </div>
);

const ThemeOpt = ({
  active, icon: Icon, label, onClick,
}: { active: boolean; icon: any; label: string; onClick: () => void }) => (
  <button onClick={onClick}
          className={cn(
            "flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 transition-colors",
            active ? "bg-primary/5 border-primary text-primary"
                   : "bg-card border-border/40 hover:bg-muted/40 text-foreground"
          )}>
    <Icon className="h-5 w-5" strokeWidth={1.8} />
    <span className="text-xs font-semibold">{label}</span>
  </button>
);

const FieldDisplay = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-border/40 p-3.5">
    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
    <p className="text-sm font-medium truncate">{children}</p>
  </div>
);

const ActionRow = ({
  icon: Icon, label, hint, external, loading, onClick,
}: { icon: any; label: string; hint?: string; external?: boolean; loading?: boolean; onClick: () => void }) => (
  <button onClick={onClick} disabled={loading}
          className="w-full flex items-center gap-3 rounded-xl border border-border/40 p-3.5 hover:bg-muted/40 transition-colors text-left">
    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold">{label}</p>
      {hint && <p className="text-[11px] text-muted-foreground leading-relaxed">{hint}</p>}
    </div>
    {loading ? <Loader2 className="h-4 w-4 animate-spin" />
             : external ? <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
  </button>
);

const DetailRow = ({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-2.5">
    {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-1" />}
    {!Icon && <span className="w-3.5" />}
    <div className="flex-1 grid grid-cols-[110px_1fr] gap-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold text-right truncate">{children}</dd>
    </div>
  </div>
);

const EmptyState = ({ icon: Icon, title, hint }: { icon: any; title: string; hint: string }) => (
  <div className="rounded-2xl border border-border/40 p-8 text-center max-w-xl">
    <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
      <Icon className="h-5 w-5 text-muted-foreground/50" />
    </div>
    <p className="font-semibold text-sm mb-1">{title}</p>
    <p className="text-xs text-muted-foreground">{hint}</p>
  </div>
);

const scopeLabel = (s?: string) =>
  s === "school" ? "Whole school" :
  s === "faculty" ? "Faculty" :
  s === "department" ? "Department" : "—";

export default Settings;
