import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  MessageSquare, TrendingUp, Users, ArrowRight,
  Loader2, Sparkles, BookOpen, ShoppingBag, Shield, Zap, Star,
  ChevronRight, Search, Bell, Plus,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo, LogoMark } from "@/components/Logo";
import { usePageMeta } from "@/hooks/usePageMeta";

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

type RecentTask = {
  id: string;
  title: string;
  category: string;
  optional_price: number | null;
  created_at: string;
};

const Index = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);

  usePageMeta({
    title: "Academic Help, Tutors & Campus Marketplace for Nigerian Students",
    description: "CampusLink is a free, AI-powered platform for Nigerian university students. Find a tutor, post a task, sell textbooks, and connect with verified peers — all in one app.",
    canonical: "https://campuslink-self.vercel.app/",
  });

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
        fetchRecentTasks();
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

  const fetchRecentTasks = async () => {
    try {
      const { data } = await supabase
        .from('posts')
        .select('id, title, category, optional_price, created_at')
        .order('created_at', { ascending: false })
        .limit(2);
      setRecentTasks((data as RecentTask[]) || []);
    } catch (error) {
      console.error('Error fetching recent tasks:', error);
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
          <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center animate-glow-pulse text-primary-foreground">
            <LogoMark size={24} />
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
    <div className="min-h-screen bg-background">
      {/* ═══ Navbar ═══ */}
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-2xl border-b border-white/10 dark:border-white/5"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between">
          <a href="/" className="group flex-shrink-0">
            <Logo size={28} />
          </a>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <ThemeToggle />
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-sm font-medium" onClick={() => navigate('/auth')}>
              Log in
            </Button>
            <Button size="sm" className="rounded-full h-9 px-4 bg-gradient-primary shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-105 active:scale-95 transition-all text-xs font-semibold" onClick={() => navigate('/auth')}>
              Get Started
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </header>

      {/* ═══ Hero Section ═══ */}
      <section className="relative pt-[calc(env(safe-area-inset-top,0px)+6rem)] pb-10 md:pt-32 md:pb-16">
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

      {/* ═══ Live preview — what the platform actually looks like ═══ */}
      <section className="relative py-10 md:py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-[1fr_360px] gap-8 lg:gap-12 items-start">
            {/* ── Copy ── */}
            <div className="order-2 lg:order-1">
              <h2 className="text-2xl sm:text-3xl md:text-[42px] font-extrabold tracking-tight leading-[1.1] mb-4">
                Built for how students actually help each other
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed mb-6 max-w-xl">
                Drop a question when you&apos;re stuck on an assignment.
                Find a peer who&apos;s already passed MTH 201. Sell your old engineering
                calculator before semester ends. Your campus is full of students who
                can help — CampusLink just makes them easy to find.
              </p>
              <ul className="space-y-3.5 max-w-md">
                <li className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <BookOpen className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground leading-tight">Academic Help</p>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-0.5">
                      Post your tutorial question or coursework. Peers chime in,
                      no more refreshing the class WhatsApp group.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Users className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground leading-tight">Tutoring</p>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-0.5">
                      Book a session with someone who&apos;s already passed the course
                      — by department, level, or the specific topic.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ShoppingBag className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground leading-tight">Buy &amp; Sell</p>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-0.5">
                      Textbooks, calculators, hostel kit, used laptops —
                      buy what you need, list what you&apos;re done with.
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            {/* ── Phone-style preview ── */}
            <div className="order-1 lg:order-2 mx-auto w-full max-w-[340px]">
              <div className="relative rounded-[36px] border border-border/40 bg-card shadow-2xl shadow-primary/10 overflow-hidden">
                {/* Notch hint */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-1.5 rounded-full bg-foreground/10" />

                <div className="px-5 pt-9 pb-5 space-y-4">
                  {/* Greeting */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-muted-foreground leading-none">Good morning,</p>
                      <p className="text-base font-bold tracking-tight mt-1">Student <span aria-hidden>👋</span></p>
                    </div>
                    <button className="relative h-9 w-9 rounded-full hover:bg-muted/40 flex items-center justify-center text-muted-foreground" aria-label="Notifications">
                      <Bell className="h-[18px] w-[18px]" />
                      <span className="absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
                    </button>
                  </div>

                  {/* Search */}
                  <div className="flex items-center gap-2 h-10 px-3.5 rounded-2xl bg-muted/40 text-muted-foreground">
                    <Search className="h-3.5 w-3.5" />
                    <span className="text-xs">Search for tasks, people, or skills…</span>
                  </div>

                  {/* Categories */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-[13px] font-bold tracking-tight">Categories</p>
                      <span className="text-[11px] font-semibold text-primary">See all</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <CategoryTile icon={BookOpen}    label="Academic Help" tint="bg-primary/10 text-primary" />
                      <CategoryTile icon={Users}       label="Tutoring"       tint="bg-emerald-500/10 text-emerald-600" />
                      <CategoryTile icon={ShoppingBag} label="Buy & Sell"     tint="bg-accent/10 text-accent" />
                    </div>
                  </div>

                  {/* Recent Tasks — real posts when there's data */}
                  <div>
                    <p className="text-[13px] font-bold tracking-tight mb-2.5">Recent Tasks</p>
                    <div className="space-y-2">
                      {recentTasks.length > 0 ? (
                        recentTasks.map((t) => (
                          <PreviewTaskCard
                            key={t.id}
                            title={t.title}
                            category={t.category}
                            price={t.optional_price}
                            ago={formatDistanceToNow(new Date(t.created_at), { addSuffix: false })}
                          />
                        ))
                      ) : (
                        <>
                          <PreviewTaskCard
                            title="Need help with Calculus assignment"
                            category="Academic Help"
                            price={3000}
                            ago="2h"
                          />
                          <PreviewTaskCard
                            title="Selling slightly used HP laptop"
                            category="Buy & Sell"
                            price={120000}
                            ago="5h"
                          />
                        </>
                      )}
                    </div>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => navigate('/auth')}
                    className="w-full h-11 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-1.5 shadow-md shadow-primary/30 hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="h-4 w-4" />Post a Task
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Stats Bar ═══ */}
      <section ref={statsSection.ref} className="relative py-10 md:py-14 border-y border-border/50">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/3 via-transparent to-accent/3" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid grid-cols-3 gap-4 sm:gap-8 text-center">
            {[
              { value: userCount, suffix: '+', label: 'Active Students', icon: Users, color: 'text-primary' },
              { value: postCount, suffix: '+', label: 'Posts Created', icon: BookOpen, color: 'text-accent' },
              { value: connectionCount, suffix: '+', label: 'Messages Sent', icon: MessageSquare, color: 'text-primary' },
            ].map((stat, i) => (
              <div key={i} className={statsSection.inView ? 'animate-count-up' : ''} style={{ animationDelay: `${i * 0.15}s` }}>
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
      <section ref={featuresSection.ref} className="py-14 md:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 md:mb-16">
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
                icon: Users,
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
      <section ref={howItWorksSection.ref} className="py-14 md:py-20 border-y border-border/50 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 md:mb-16">
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
      <section ref={ctaSection.ref} className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div>
            <div className="relative inline-block mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-3xl scale-150" />
              <div className="relative h-16 w-16 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto shadow-2xl shadow-primary/30 text-primary-foreground">
                <LogoMark size={32} />
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
              <div className="h-7 w-7 rounded-lg bg-gradient-primary flex items-center justify-center text-primary-foreground">
                <LogoMark size={14} />
              </div>
              <span className="font-bold text-sm tracking-tight">Campus Link</span>
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

/* ─── Small helpers used by the live-preview phone card ─── */
const CategoryTile = ({
  icon: Icon, label, tint,
}: { icon: typeof BookOpen; label: string; tint: string }) => (
  <div className="rounded-2xl bg-muted/30 border border-border/30 p-2.5 flex flex-col items-center gap-1.5 text-center">
    <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${tint}`}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
    </div>
    <p className="text-[10px] font-semibold leading-tight">{label}</p>
  </div>
);

const PreviewTaskCard = ({
  title, category, price, ago,
}: { title: string; category: string; price: number | null; ago: string }) => {
  const cleanAgo = ago.replace("about ", "")
    .replace(" minutes", "m").replace(" minute", "m")
    .replace(" hours", "h").replace(" hour", "h")
    .replace(" days", "d").replace(" day", "d")
    .replace("less than a m", "now");
  return (
    <div className="rounded-2xl bg-muted/20 border border-border/30 p-3 flex items-start gap-2.5">
      <div className="h-9 w-9 rounded-xl bg-card border border-border/40 flex items-center justify-center flex-shrink-0">
        <BookOpen className="h-4 w-4 text-primary/80" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11.5px] font-bold leading-tight truncate">{title}</p>
        <span className="inline-block mt-1 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
          {category}
        </span>
      </div>
      <div className="text-right flex-shrink-0">
        {price != null && (
          <p className="text-[11.5px] font-bold text-emerald-600 leading-tight">
            ₦{Number(price).toLocaleString()}
          </p>
        )}
        <p className="text-[9px] text-muted-foreground mt-0.5">{cleanAgo} ago</p>
      </div>
    </div>
  );
};

export default Index;
