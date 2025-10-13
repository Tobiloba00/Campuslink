import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GraduationCap, MessageSquare, TrendingUp, Users, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        navigate("/feed");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        navigate("/feed");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">CampusLink</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <a href="/auth">Login</a>
            </Button>
            <Button asChild>
              <a href="/auth">Sign Up</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 text-foreground">
            Connect with peers, get help, and share resources
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl">
            CampusLink is the easiest way for university students to find academic support, trade textbooks, and connect with the campus community.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-20">
            <Button size="lg" asChild className="shadow-hover">
              <a href="/auth">Get Started</a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="/feed">Browse Feed</a>
            </Button>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 w-full mt-8">
            <div className="bg-card rounded-xl p-6 shadow-card hover:shadow-hover transition-shadow">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Academic Help</h3>
              <p className="text-muted-foreground">
                Request assistance with assignments, projects, and studying from fellow students
              </p>
            </div>

            <div className="bg-card rounded-xl p-6 shadow-card hover:shadow-hover transition-shadow">
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <MessageSquare className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-bold mb-2">Direct Messaging</h3>
              <p className="text-muted-foreground">
                Connect privately with students to discuss collaboration and learning opportunities
              </p>
            </div>

            <div className="bg-card rounded-xl p-6 shadow-card hover:shadow-hover transition-shadow">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Build Reputation</h3>
              <p className="text-muted-foreground">
                Earn ratings and climb the leaderboard by helping your peers succeed
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-primary/5 py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">500+</div>
              <div className="text-muted-foreground">Active Students</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-accent mb-2">1,200+</div>
              <div className="text-muted-foreground">Posts Created</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">850+</div>
              <div className="text-muted-foreground">Successful Connections</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to join the community?</h2>
        <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
          Sign up now and start connecting with fellow students who share your academic journey.
        </p>
        <Button size="lg" asChild className="shadow-hover">
          <a href="/auth">Create Your Account</a>
        </Button>
      </div>
    </div>
  );
};

export default Index;
