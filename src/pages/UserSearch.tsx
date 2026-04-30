import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Search,
  MessageCircle,
  Star,
  Users,
  Loader2,
  SlidersHorizontal,
  UserPlus,
  ArrowRight,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";

interface Profile {
  id: string;
  name: string;
  course: string | null;
  year_of_study: string | null;
  skills: string[] | null;
  bio: string | null;
  profile_picture: string | null;
  rating: number;
}

// Cycle of soft tag colors for skill chips
const SKILL_COLORS = [
  "bg-primary/10 text-primary",
  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "bg-accent/15 text-accent",
  "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
];

const formatYear = (year: string | null) => {
  if (!year) return null;
  return /level|year/i.test(year) ? year : `${year} Level`;
};

const UserSearch = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "online">("all");
  const navigate = useNavigate();

  useEffect(() => {
    fetchCurrentUser();
    fetchProfiles();
  }, []);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("rating", { ascending: false });
      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProfiles = profiles
    .filter((profile) => profile.id !== currentUser?.id)
    .filter((profile) => {
      const query = searchQuery.toLowerCase();
      if (!query) return true;
      return (
        profile.name?.toLowerCase().includes(query) ||
        profile.course?.toLowerCase().includes(query) ||
        profile.bio?.toLowerCase().includes(query) ||
        profile.skills?.some((s) => s?.toLowerCase().includes(query))
      );
    });

  const handleMessage = (userId: string) => {
    if (!currentUser) {
      toast.error("Please log in to send messages");
      navigate("/auth");
      return;
    }
    navigate(`/messages?userId=${userId}`);
  };

  const handleRateUser = (userId: string) => {
    if (!currentUser) {
      toast.error("Please log in to rate users");
      navigate("/auth");
      return;
    }
    navigate(`/rate-user/${userId}`);
  };

  const handleInvite = async () => {
    const url = `${window.location.origin}/auth`;
    const shareData = {
      title: "Join me on CampusLink",
      text: "Find help, tutors and great people on campus.",
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Invite link copied!");
      }
    } catch {
      /* user cancelled — no-op */
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-2xl lg:max-w-3xl mx-auto px-4 sm:px-5 pt-[calc(env(safe-area-inset-top,0px)+76px)] pb-32 lg:pb-12">
        {/* ─── Hero ─── */}
        <div className="flex items-start justify-between gap-3 mb-7 animate-hero">
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="text-[34px] sm:text-[40px] font-extrabold tracking-tight leading-[1.05] mb-2">
              Find People
            </h1>
            <p className="text-sm sm:text-[15px] text-muted-foreground leading-relaxed max-w-sm">
              Connect and collaborate with students on campus.
            </p>
          </div>
          <FindPeopleArtwork />
        </div>

        {/* ─── Search + filter button ─── */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 relative bg-card rounded-2xl border border-border/50 shadow-sm">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by name, course, department, or bio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-12 bg-transparent border-none focus-visible:ring-0 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-2xl border-border/50 bg-card flex-shrink-0 hover:bg-muted"
            aria-label="Open filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* ─── Filter pills ─── */}
        <div className="flex items-center gap-2 mb-7 overflow-x-auto scrollbar-hide -mx-4 px-4">
          <FilterPill
            active={activeFilter === "all"}
            onClick={() => setActiveFilter("all")}
          >
            All
          </FilterPill>
          <FilterPill
            active={activeFilter === "online"}
            onClick={() =>
              setActiveFilter((f) => (f === "online" ? "all" : "online"))
            }
          >
            <span
              className={`h-2 w-2 rounded-full mr-1.5 ${
                activeFilter === "online" ? "bg-white" : "bg-emerald-500"
              }`}
            />
            Online Now
          </FilterPill>
        </div>

        {/* ─── Section header ─── */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold tracking-tight">
            {searchQuery ? "Results" : "Popular on Campus"}
          </h2>
        </div>

        {/* ─── User cards ─── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {searchQuery && (
              <p className="text-xs text-muted-foreground mb-3 font-medium">
                {filteredProfiles.length} result
                {filteredProfiles.length !== 1 ? "s" : ""} found
              </p>
            )}

            <div className="space-y-3">
              {filteredProfiles.map((profile, i) => {
                const skill = profile.skills?.find(Boolean);
                const skillColor = SKILL_COLORS[i % SKILL_COLORS.length];
                const yearText = formatYear(profile.year_of_study);

                return (
                  <div
                    key={profile.id}
                    className="bg-card rounded-2xl border border-border/40 p-4 hover:border-primary/30 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <Avatar className="h-14 w-14">
                          <AvatarImage
                            src={profile.profile_picture || ""}
                            alt={profile.name}
                          />
                          <AvatarFallback className="text-base bg-primary/10 text-primary font-bold">
                            {profile.name?.charAt(0).toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[15px] truncate leading-tight">
                          {profile.name}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {profile.course || "Student"}
                          {yearText ? ` • ${yearText}` : ""}
                        </p>
                        {skill && (
                          <span
                            className={`inline-block mt-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${skillColor}`}
                          >
                            {skill}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Button
                          onClick={() => handleMessage(profile.id)}
                          size="sm"
                          className="h-9 rounded-full px-3.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20 text-xs font-semibold"
                        >
                          <MessageCircle className="h-3.5 w-3.5 mr-1" />
                          Message
                        </Button>
                        <Button
                          onClick={() => handleRateUser(profile.id)}
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-full border-border/50 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:border-amber-200 dark:hover:border-amber-500/30 transition-colors"
                          aria-label={`Rate ${profile.name}`}
                        >
                          <Star className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredProfiles.length === 0 && (
              <div className="text-center py-16 animate-hero">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <Users className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <p className="font-semibold mb-1">No users found</p>
                <p className="text-sm text-muted-foreground">
                  Try a different search term
                </p>
              </div>
            )}

            {/* ─── Grow network CTA ─── */}
            {filteredProfiles.length > 0 && (
              <div className="mt-6 bg-primary/[0.06] dark:bg-primary/[0.08] border border-primary/10 rounded-2xl p-4 flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">Grow your network</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Connect with more students and build meaningful relationships.
                  </p>
                </div>
                <Button
                  onClick={handleInvite}
                  variant="outline"
                  className="h-9 rounded-xl border-primary/30 text-primary hover:bg-primary/10 text-xs font-semibold flex-shrink-0 px-3"
                >
                  Invite Friends
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

/* ────────────────────────────────────────────
   Filter pill
   ──────────────────────────────────────────── */
const FilterPill = ({
  active = false,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`flex-shrink-0 h-9 px-4 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
      active
        ? "bg-primary text-primary-foreground border border-primary"
        : "bg-card border border-border/50 text-foreground hover:bg-muted"
    }`}
  >
    {children}
  </button>
);

/* ────────────────────────────────────────────
   Inline artwork — people circles + magnifier
   ──────────────────────────────────────────── */
const FindPeopleArtwork = () => (
  <svg
    width="118"
    height="118"
    viewBox="0 0 118 118"
    className="flex-shrink-0 sm:w-[140px] sm:h-[140px]"
    fill="none"
    aria-hidden="true"
  >
    {/* Distant person (top-right, faded) */}
    <circle cx="92" cy="22" r="11" fill="hsl(var(--muted))" />
    <circle cx="92" cy="20" r="3.5" fill="hsl(var(--muted-foreground) / 0.45)" />
    <path
      d="M84 32 Q84 28 92 28 Q100 28 100 32 Z"
      fill="hsl(var(--muted-foreground) / 0.45)"
    />

    {/* Mid person */}
    <circle cx="78" cy="28" r="14" fill="hsl(var(--primary) / 0.10)" />
    <circle cx="78" cy="26" r="4.5" fill="hsl(var(--primary) / 0.55)" />
    <path
      d="M68 38 Q68 33 78 33 Q88 33 88 38 Z"
      fill="hsl(var(--primary) / 0.55)"
    />

    {/* Lead person */}
    <circle cx="38" cy="32" r="18" fill="hsl(var(--primary) / 0.14)" />
    <circle cx="38" cy="29" r="6" fill="hsl(var(--primary))" />
    <path
      d="M25 46 Q25 39 38 39 Q51 39 51 46 Z"
      fill="hsl(var(--primary))"
    />

    {/* Magnifying glass */}
    <circle
      cx="62"
      cy="68"
      r="22"
      stroke="hsl(var(--foreground) / 0.85)"
      strokeWidth="3"
      fill="hsl(var(--card))"
    />
    <circle cx="62" cy="64" r="5" fill="hsl(var(--success))" />
    <path
      d="M55 76 Q62 71 69 76"
      stroke="hsl(var(--foreground) / 0.85)"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
    <line
      x1="80"
      y1="86"
      x2="100"
      y2="106"
      stroke="hsl(var(--foreground) / 0.85)"
      strokeWidth="6"
      strokeLinecap="round"
    />
  </svg>
);

export default UserSearch;
