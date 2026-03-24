import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  GraduationCap, MessageSquare, TrendingUp, Users, ArrowRight,
  Loader2, Sparkles, BookOpen, ShoppingBag, Shield, Zap, Star,
  ChevronRight
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";

type PlatformStats = {
  users: number;
  posts: number;
  connections: number;
};

const useCountUp = (end: number, duration = 2000, start = false) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start || end === 0) return;
    let startTime: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [end, duration, start]);
  return count;
};

const useInView = (threshold = 0.2) => {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
};

const Index = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PlatformStats | null>(null);

  const statsSection = useInView(0.3);
  const featuresSection = useInView(0.15);
  const howItWorksSection = useInView(0.15);
  const ctaSection = useInView(0.2);

  const userCount = useCountUp(stats?.users || 0, 2000, statsSection.inView);
  const postCount = useCountUp(stats?.posts || 0, 2000, statsSection.inView);
  const connectionCount = useCountUp(stats?.connections || 0, 2500, statsSection.inView);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/feed", { replace: true });
      } else {
        setLoading(false);
        fetchStats();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        navigate("/feed", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchStats = async () => {
    try {
      const [profilesResult, postsResult, messagesResult] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('posts').select('id', { count: 'exact', head: true }),
        supabase.from('messages').select('room_id', { count: 'exact', head: true }),
      ]);
      setStats({
        users: profilesResult.count || 0,
        posts: postsResult.count || 0,
        connections: messagesResult.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return `${num}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center animate-glow-pulse">
            <GraduationCap className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Loading CampusLink...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* ═══ Navbar ═══ */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-2xl border-b border-white/10 dark:border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="/" className="group">
            <Logo size={36} showText textClassName="text-lg" />
          </a>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-sm font-medium" onClick={() => navigate('/auth')}>
              Log in
            </Button>
            <Button size="sm" className="rounded-full px-5 bg-gradient-primary shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-105 active:scale-95 transition-all text-sm font-semibold" onClick={() => navigate('/auth')}>
              Get Started
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ═══ Hero Section ═══ */}
      <section className="relative pt-28 pb-16 md:pt-40 md:pb-28">
        {/* Decorative elements */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-40 left-1/4 w-[300px] h-[300px] bg-accent/5 rounded-full blur-[100px] pointer-events-none animate-float-slow" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center relative z-10">
          {/* Trust badge */}
          <div className="animate-hero inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 mb-8 hover:bg-primary/10 transition-colors cursor-default">
            <div className="flex -space-x-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-5 w-5 rounded-full bg-gradient-primary border-2 border-background flex items-center justify-center">
                  <span className="text-[8px] text-white font-bold">{['A', 'K', 'T'][i]}</span>
                </div>
              ))}
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              Trusted by {stats ? `${formatNumber(stats.users)}+` : '...'} students
            </span>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          </div>

          {/* Main headline */}
          <h1 className="animate-hero text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Your campus,{" "}
            <span className="text-gradient-accent">connected.</span>
          </h1>

          {/* Subheadline */}
          <p className="animate-hero-delayed text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            The all-in-one platform where students find help, trade resources, and build real connections that matter.
          </p>

          {/* CTAs */}
          <div className="animate-hero-delayed-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="h-13 px-8 text-base font-semibold rounded-full bg-gradient-primary shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:scale-105 active:scale-95 transition-all"
              onClick={() => navigate('/auth')}
            >
              Start for free
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-13 px-8 text-base font-semibold rounded-full border-border/50 hover:bg-primary/5 hover:border-primary/20 transition-all"
              onClick={() => navigate('/feed')}
            >
              Explore the feed
            </Button>
          </div>

          {/* Powered by AI badge */}
          <div className="animate-hero-delayed-2 mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Powered by AI — smart matching, summaries & insights</span>
          </div>
        </div>
      </section>

      {/* ═══ Stats Bar ═══ */}
      <section ref={statsSection.ref} className="relative py-16 md:py-20 border-y border-border/50">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/3 via-transparent to-accent/3" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid grid-cols-3 gap-4 sm:gap-8 text-center">
            {[
              { value: userCount, suffix: '+', label: 'Active Students', icon: Users, color: 'text-primary' },
              { value: postCount, suffix: '+', label: 'Posts Created', icon: BookOpen, color: 'text-accent' },
              { value: connectionCount, suffix: '+', label: 'Messages Sent', icon: MessageSquare, color: 'text-primary' },
            ].map((stat, i) => (
              <div key={i} className={`${statsSection.inView ? 'animate-count-up' : 'opacity-0'}`} style={{ animationDelay: `${i * 0.15}s` }}>
                <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-2 sm:mb-3 ${stat.color} opacity-60`} />
                <div className={`text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight ${stat.color}`}>
                  {formatNumber(stat.value)}{stat.suffix}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Features Grid ═══ */}
      <section ref={featuresSection.ref} className="py-20 md:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className={`text-center mb-16 transition-all duration-700 ${featuresSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-bold uppercase tracking-wider mb-4">
              <Zap className="h-3 w-3" /> Features
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              Everything you need to{" "}
              <span className="text-gradient">thrive on campus</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built by students, for students. Every feature designed to make campus life easier.
            </p>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${featuresSection.inView ? 'animate-stagger' : ''}`}>
            {[
              {
                icon: BookOpen,
                title: 'Academic Help',
                description: 'Get instant help with assignments, projects, and exam prep from peers who\'ve been there.',
                gradient: 'from-blue-500/10 to-blue-600/5',
                iconBg: 'bg-blue-500/10',
                iconColor: 'text-blue-500',
              },
              {
                icon: GraduationCap,
                title: 'Find Tutors',
                description: 'Connect with top-rated student tutors in any subject. Book sessions and climb the grades.',
                gradient: 'from-emerald-500/10 to-emerald-600/5',
                iconBg: 'bg-emerald-500/10',
                iconColor: 'text-emerald-500',
              },
              {
                icon: ShoppingBag,
                title: 'Marketplace',
                description: 'Buy, sell, and trade textbooks, electronics, and study materials at student-friendly prices.',
                gradient: 'from-orange-500/10 to-orange-600/5',
                iconBg: 'bg-orange-500/10',
                iconColor: 'text-orange-500',
              },
              {
                icon: MessageSquare,
                title: 'Real-Time Chat',
                description: 'Message anyone instantly with typing indicators, read receipts, and image sharing.',
                gradient: 'from-violet-500/10 to-violet-600/5',
                iconBg: 'bg-violet-500/10',
                iconColor: 'text-violet-500',
              },
              {
                icon: Sparkles,
                title: 'AI-Powered',
                description: 'Smart post analysis, auto-summaries, conversation starters, and an AI assistant that knows campus.',
                gradient: 'from-primary/10 to-primary/5',
                iconBg: 'bg-primary/10',
                iconColor: 'text-primary',
              },
              {
                icon: Star,
                title: 'Reputation System',
                description: 'Build your campus reputation with ratings, reviews, and leaderboard rankings.',
                gradient: 'from-amber-500/10 to-amber-600/5',
                iconBg: 'bg-amber-500/10',
                iconColor: 'text-amber-500',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className={`group relative rounded-3xl border border-border/50 bg-gradient-to-br ${feature.gradient} p-7 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 cursor-default`}
              >
                <div className={`h-12 w-12 rounded-2xl ${feature.iconBg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
                </div>
                <h3 className="text-lg font-bold mb-2 tracking-tight">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ How It Works ═══ */}
      <section ref={howItWorksSection.ref} className="py-20 md:py-32 border-y border-border/50 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className={`text-center mb-16 transition-all duration-700 ${howItWorksSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-4">
              <Shield className="h-3 w-3" /> How it works
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
              Up and running in <span className="text-gradient">3 minutes</span>
            </h2>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 ${howItWorksSection.inView ? 'animate-stagger' : ''}`}>
            {[
              {
                step: '01',
                title: 'Create your profile',
                description: 'Sign up with your student email. Add your courses, skills, and interests so the AI can match you perfectly.',
              },
              {
                step: '02',
                title: 'Post or discover',
                description: 'Need help? Create a post. Want to help? Browse the feed. Our AI tags and surfaces the most relevant content.',
              },
              {
                step: '03',
                title: 'Connect & grow',
                description: 'Message students directly, build your reputation through ratings, and become a campus leader.',
              },
            ].map((item, i) => (
              <div key={i} className="relative text-center md:text-left">
                <div className="text-6xl md:text-7xl font-black text-primary/8 dark:text-primary/10 mb-4 leading-none tracking-tighter select-none">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-3 tracking-tight -mt-2">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA Section ═══ */}
      <section ref={ctaSection.ref} className="py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className={`transition-all duration-700 ${ctaSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="relative inline-block mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-3xl scale-150" />
              <div className="relative h-16 w-16 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto shadow-2xl shadow-primary/30">
                <GraduationCap className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
              Ready to transform your{" "}
              <span className="text-gradient-accent">campus experience?</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
              Join the community that's redefining how students connect, learn, and help each other succeed.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="h-14 px-10 text-base font-bold rounded-full bg-gradient-primary shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105 active:scale-95 transition-all"
                onClick={() => navigate('/auth')}
              >
                Create free account
                <ArrowRight className="h-4.5 w-4.5 ml-2" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/60 mt-6">
              Free forever for students. No credit card required.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="border-t border-border/50 py-10 md:py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-gradient-primary flex items-center justify-center">
                <GraduationCap className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm tracking-tight">CampusLink</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <button onClick={() => navigate('/feed')} className="hover:text-foreground transition-colors">Feed</button>
              <button onClick={() => navigate('/leaderboard')} className="hover:text-foreground transition-colors">Leaderboard</button>
              <button onClick={() => navigate('/auth')} className="hover:text-foreground transition-colors">Sign up</button>
            </div>
            <p className="text-xs text-muted-foreground/60">
              Powered by <span className="font-semibold text-foreground/60">Omniai</span> &middot; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
