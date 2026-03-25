import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Award, Star, Crown, MessageSquare, ArrowLeft } from "lucide-react";
import BottomNav from "@/components/BottomNav";

const Leaderboard = () => {
  const navigate = useNavigate();
  const [topHelpers, setTopHelpers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .gt('rating', 0)
      .order('rating', { ascending: false })
      .limit(20);
    setTopHelpers(data || []);
    setIsLoading(false);
  };

  const getRankDisplay = (index: number) => {
    if (index === 0) return { icon: Crown, color: 'text-amber-400', bg: 'bg-amber-400/10', ring: 'ring-amber-400/30' };
    if (index === 1) return { icon: Medal, color: 'text-gray-400', bg: 'bg-gray-400/10', ring: 'ring-gray-400/20' };
    if (index === 2) return { icon: Award, color: 'text-amber-600', bg: 'bg-amber-600/10', ring: 'ring-amber-600/20' };
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 pt-[76px] pb-24 lg:pb-8">
        {/* Header */}
        <div className="text-center mb-10 animate-hero">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-2xl shadow-amber-500/30 mb-5">
            <Trophy className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
            <span className="text-gradient-accent">Top Helpers</span>
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            The most helpful students on campus, ranked by peer reviews and ratings.
          </p>
        </div>

        {/* Top 3 Podium */}
        {topHelpers.length >= 3 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8 animate-hero-delayed">
            {[1, 0, 2].map((idx) => {
              const helper = topHelpers[idx];
              const rank = getRankDisplay(idx)!;
              const isFirst = idx === 0;
              return (
                <div
                  key={helper.id}
                  className={`text-center ${isFirst ? '-mt-2 sm:-mt-4' : 'mt-1 sm:mt-2'}`}
                >
                  <div className={`relative inline-block mb-2 sm:mb-3`}>
                    <Avatar className={`${isFirst ? 'h-16 w-16 sm:h-24 sm:w-24' : 'h-12 w-12 sm:h-20 sm:w-20'} ring-2 sm:ring-4 ${rank.ring} shadow-xl`}>
                      <AvatarImage src={helper.profile_picture || ""} />
                      <AvatarFallback className="bg-gradient-primary text-primary-foreground font-bold text-sm sm:text-lg">
                        {helper.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute -top-1 -right-1 sm:-top-2 sm:-right-2 h-5 w-5 sm:h-7 sm:w-7 rounded-full ${rank.bg} flex items-center justify-center border-2 border-background shadow-sm`}>
                      <rank.icon className={`h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 ${rank.color}`} />
                    </div>
                  </div>
                  <p className="font-bold text-xs sm:text-sm truncate px-0.5">{helper.name}</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-bold">{helper.rating.toFixed(1)}</span>
                  </div>
                  {helper.course && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate px-1">{helper.course}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Rest of list */}
        <div className="space-y-2 animate-hero-delayed-2">
          {topHelpers.slice(3).map((helper, i) => (
            <Card
              key={helper.id}
              className="glass-panel border-white/10 hover:border-primary/10 transition-all cursor-pointer group"
              onClick={() => navigate(`/messages?userId=${helper.id}`)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <span className="text-sm font-bold text-muted-foreground w-6 text-center">
                  {i + 4}
                </span>
                <Avatar className="h-11 w-11 ring-2 ring-primary/5 group-hover:scale-105 transition-transform">
                  <AvatarImage src={helper.profile_picture || ""} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                    {helper.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm group-hover:text-primary transition-colors truncate">{helper.name}</p>
                  {helper.course && (
                    <p className="text-xs text-muted-foreground truncate">{helper.course}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-amber-500/10 px-3 py-1.5 rounded-full">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-bold">{helper.rating.toFixed(1)}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 rounded-full hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); navigate(`/messages?userId=${helper.id}`); }}
                  >
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {topHelpers.length === 0 && !isLoading && (
          <div className="text-center py-20">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" />
            <p className="text-lg font-semibold text-muted-foreground mb-2">No ratings yet</p>
            <p className="text-sm text-muted-foreground/60 mb-6">Be the first to help someone and earn your spot!</p>
            <Button variant="outline" className="rounded-full" onClick={() => navigate('/feed')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Browse the feed
            </Button>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default Leaderboard;
