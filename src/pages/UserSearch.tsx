import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, MessageCircle, Star, Users, Loader2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";

interface Profile {
  id: string;
  name: string;
  course: string | null;
  bio: string | null;
  profile_picture: string | null;
  rating: number;
}

const UserSearch = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
      return (
        profile.name.toLowerCase().includes(query) ||
        profile.course?.toLowerCase().includes(query) ||
        profile.bio?.toLowerCase().includes(query)
      );
    });

  const handleMessage = async (userId: string) => {
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 pt-24 pb-24 lg:pb-8">
        {/* Header */}
        <div className="mb-8 animate-hero">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Find People</h1>
              <p className="text-sm text-muted-foreground">Discover students on campus</p>
            </div>
          </div>

          {/* Search */}
          <div className="glass-panel p-2 border-white/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, course, or bio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-transparent border-none focus-visible:ring-0 text-base"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Results count */}
            {searchQuery && (
              <p className="text-xs text-muted-foreground mb-4 font-medium">
                {filteredProfiles.length} result{filteredProfiles.length !== 1 ? 's' : ''} found
              </p>
            )}

            {/* User Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProfiles.map((profile, i) => (
                <div
                  key={profile.id}
                  className="glass-panel border-white/10 p-5 hover:border-primary/10 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group cursor-default"
                  style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s` }}
                >
                  <div className="flex items-start gap-4">
                    <Avatar className="h-14 w-14 ring-2 ring-primary/5 group-hover:ring-primary/20 transition-all">
                      <AvatarImage src={profile.profile_picture || ""} alt={profile.name} />
                      <AvatarFallback className="text-lg bg-gradient-primary text-primary-foreground font-bold">
                        {profile.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base truncate group-hover:text-primary transition-colors">
                        {profile.name}
                      </h3>
                      {profile.course && (
                        <p className="text-xs text-muted-foreground truncate">{profile.course}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-xs font-bold">{Number(profile.rating).toFixed(1)}</span>
                      </div>
                    </div>
                  </div>

                  {profile.bio && (
                    <p className="text-sm text-muted-foreground mt-3 line-clamp-2 leading-relaxed">{profile.bio}</p>
                  )}

                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => handleMessage(profile.id)}
                      size="sm"
                      className="flex-1 h-9 rounded-xl bg-gradient-primary shadow-sm hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-xs font-semibold"
                    >
                      <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                      Message
                    </Button>
                    <Button
                      onClick={() => handleRateUser(profile.id)}
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl border-border/50 hover:bg-primary/5 transition-all text-xs font-semibold px-3"
                    >
                      <Star className="h-3.5 w-3.5 mr-1" />
                      Rate
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {filteredProfiles.length === 0 && (
              <div className="text-center py-20 animate-hero">
                <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <p className="font-semibold mb-1">No users found</p>
                <p className="text-sm text-muted-foreground">Try a different search term</p>
              </div>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default UserSearch;
