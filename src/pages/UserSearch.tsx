import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, MessageCircle, Star } from "lucide-react";
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
    .filter((profile) => profile.id !== currentUser?.id) // Exclude current user
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pb-8 pt-28">
          <p className="text-center text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-28 pb-36 lg:pb-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Find Users
          </h1>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, course, or bio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {filteredProfiles.map((profile) => (
            <Card
              key={profile.id}
              className="hover:shadow-lg transition-all duration-300 hover:scale-105"
            >
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="w-20 h-20 md:w-24 md:h-24 mb-4">
                    <AvatarImage src={profile.profile_picture || ""} alt={profile.name} />
                    <AvatarFallback className="text-xl md:text-2xl bg-primary/10 text-primary">
                      {profile.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <h3 className="text-lg md:text-xl font-semibold text-foreground mb-1">
                    {profile.name}
                  </h3>

                  {profile.course && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {profile.course}
                    </p>
                  )}

                  <div className="flex items-center gap-1 mb-3">
                    <Star className="w-4 h-4 fill-accent text-accent" />
                    <span className="text-sm font-medium">
                      {Number(profile.rating).toFixed(1)}
                    </span>
                  </div>

                  {profile.bio && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {profile.bio}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleMessage(profile.id)}
                      className="flex-1"
                      size="sm"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Message
                    </Button>
                    <Button
                      onClick={() => handleRateUser(profile.id)}
                      variant="outline"
                      className="flex-1"
                      size="sm"
                    >
                      <Star className="w-4 h-4 mr-2" />
                      Rate
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredProfiles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No users found matching your search.</p>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default UserSearch;
