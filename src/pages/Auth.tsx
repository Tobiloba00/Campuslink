import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { GraduationCap, ArrowRight, BookOpen, MessageSquare, Star, Eye, EyeOff } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        toast.success("Account created! Please check your email to verify.");
        navigate("/");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate("/");
      }
    } catch (error: any) {
      toast.error(error.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: BookOpen, text: 'Get help with assignments from peers who aced the same courses' },
    { icon: MessageSquare, text: 'Real-time messaging with typing indicators and AI suggestions' },
    { icon: Star, text: 'Build your campus reputation and climb the leaderboard' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Social Proof (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/80">
        {/* Background texture */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.05)_0%,transparent_50%)]" />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <div>
            <button onClick={() => navigate('/')} className="flex items-center gap-2.5 group">
              <img src="/logo.png" alt="CampusLink" className="h-10 w-10 object-contain invert brightness-110 group-hover:scale-110 transition-transform" />
              <span className="font-bold text-lg text-white tracking-tight">CampusLink</span>
            </button>
          </div>

          {/* Main content */}
          <div className="space-y-10">
            <div>
              <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight tracking-tight mb-4">
                Where students help students succeed.
              </h2>
              <p className="text-white/70 text-lg leading-relaxed max-w-md">
                Join a community built on collaboration, trust, and mutual growth.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-5">
              {features.map((feature, i) => (
                <div key={i} className="flex items-start gap-4 group">
                  <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10 flex-shrink-0 group-hover:bg-white/15 transition-colors">
                    <feature.icon className="h-5 w-5 text-white/90" />
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed pt-2">{feature.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom quote */}
          <div className="pt-8 border-t border-white/10">
            <p className="text-white/50 text-xs">
              Powered by <span className="text-white/70 font-semibold">Omniai</span> &middot; AI-driven campus networking
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel — Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 relative">
        <div className="mesh-background" />

        {/* Mobile logo */}
        <button onClick={() => navigate('/')} className="absolute top-6 left-6 flex items-center gap-2 lg:hidden">
          <img src="/logo.png" alt="CampusLink" className="h-9 w-9 object-contain logo-adaptive" />
          <span className="font-bold text-sm tracking-tight">CampusLink</span>
        </button>

        <div className="w-full max-w-sm relative z-10 animate-hero">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="lg:hidden mx-auto mb-5">
              <img src="/logo.png" alt="CampusLink" className="h-16 w-16 object-contain logo-adaptive mx-auto" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
              {isSignUp ? "Create your account" : "Welcome back"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isSignUp
                ? "Start connecting with your campus community"
                : "Sign in to continue where you left off"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Full name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-background transition-colors"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@student.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-background transition-colors"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-background transition-colors pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gradient-primary shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all font-semibold text-sm"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{isSignUp ? "Creating account..." : "Signing in..."}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>{isSignUp ? "Create account" : "Sign in"}</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs text-muted-foreground">or</span>
            </div>
          </div>

          {/* Toggle */}
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full h-12 rounded-xl border border-border/50 text-sm font-medium hover:bg-muted/50 transition-all active:scale-[0.98]"
          >
            {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
          </button>

          {/* Terms */}
          <p className="text-center text-[11px] text-muted-foreground/60 mt-6 leading-relaxed">
            By continuing, you agree to CampusLink's Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
