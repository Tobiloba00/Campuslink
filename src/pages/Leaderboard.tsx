import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Medal, Award, Star } from "lucide-react";

const Leaderboard = () => {
  const [topHelpers, setTopHelpers] = useState<any[]>([]);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .gt('rating', 0)
      .order('rating', { ascending: false })
      .limit(10);

    setTopHelpers(data || []);
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-6 w-6 text-amber-400" />;
      case 1:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 2:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-4xl">
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 bg-gradient-hero bg-clip-text text-transparent">
            Top Helpers Leaderboard
          </h1>
          <p className="text-muted-foreground">Recognizing our most helpful community members</p>
        </div>

        <div className="space-y-4">
          {topHelpers.map((helper, index) => (
            <Card
              key={helper.id}
              className={`shadow-card hover:shadow-hover transition-all ${
                index < 3 ? "border-2 border-primary/20" : ""
              }`}
            >
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="flex-shrink-0 w-8 md:w-12 flex justify-center">
                    {getRankIcon(index)}
                  </div>

                  <Avatar className="h-10 w-10 md:h-12 md:w-12 bg-gradient-primary">
                    <AvatarFallback className="bg-transparent text-primary-foreground font-bold">
                      {helper.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base md:text-lg truncate">{helper.name}</h3>
                    {helper.course && (
                      <p className="text-xs md:text-sm text-muted-foreground truncate">{helper.course}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 md:gap-2 bg-accent/10 px-2 md:px-4 py-1 md:py-2 rounded-lg">
                    <Star className="h-4 w-4 md:h-5 md:w-5 text-amber-400 fill-amber-400" />
                    <span className="text-lg md:text-2xl font-bold">{helper.rating.toFixed(1)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {topHelpers.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">No ratings yet. Be the first to help!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
