import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { LogOut, User as UserIcon, MessageSquare, LayoutDashboard, Trophy, Home, Search, Bell, Moon, Sun } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Navbar = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const navHidden = useScrollDirection(12);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const checkAdmin = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('profile_picture, name')
        .eq('id', user.id)
        .single();
      setUserProfile(data);
    };
    fetchProfile();
  }, [user]);

  // Unread-notifications count for the bell badge — also subscribed in real-time
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null);
      if (!cancelled) setUnreadNotifications(count ?? 0);
    };
    fetchUnread();

    const channel = supabase
      .channel(`navbar-notifs-${user.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => fetchUnread())
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => fetchUnread())
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const isActive = (path: string) => location.pathname === path;

  const desktopLinks = [
    { path: '/feed', icon: Home, label: 'Feed' },
    { path: '/user-search', icon: Search, label: 'Explore' },
    { path: '/messages', icon: MessageSquare, label: 'Messages' },
    { path: '/leaderboard', icon: Trophy, label: 'Leaders' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-2xl transition-transform duration-300 ease-out ${
        navHidden ? '-translate-y-full' : 'translate-y-0'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <nav className="h-14 flex items-center justify-between px-4 sm:px-6 max-w-6xl w-full mx-auto">

        {/* Left — wordmark only ("Campus Link" with the connector word in primary) */}
        <Link to={user ? "/feed" : "/"} className="flex items-center z-10 min-w-0">
          <span className="font-display font-extrabold text-[18px] sm:text-base tracking-tight leading-none">
            <span className="text-foreground">Campus</span>{' '}<span className="text-primary">Link</span>
          </span>
        </Link>

        {/* Right — Actions */}
        <div className="flex items-center gap-1 z-10">
          {/* Mobile-only icons that match the mockup. Desktop has full link bar below. */}
          {user && (
            <div className="flex items-center gap-1 lg:hidden">
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="h-10 w-10 rounded-full hover:bg-muted text-foreground/80"
                aria-label="Search people"
              >
                <Link to="/user-search"><Search className="h-[20px] w-[20px]" /></Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-10 w-10 rounded-full hover:bg-muted text-foreground/80"
                aria-label="Notifications"
                onClick={() => navigate('/notifications')}
              >
                <Bell className="h-[20px] w-[20px]" />
                {unreadNotifications > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full ring-2 ring-background">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </Button>
            </div>
          )}

          {user && desktopLinks.map((link) => (
            <Button
              key={link.path}
              variant="ghost"
              size="sm"
              asChild
              className={`hidden lg:flex h-9 px-3 rounded-xl transition-all ${
                isActive(link.path)
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Link to={link.path}>
                <link.icon className="h-4 w-4 mr-1.5" />
                <span className="text-xs font-medium">{link.label}</span>
              </Link>
            </Button>
          ))}

          {user && isAdmin && (
            <Button variant="ghost" size="sm" asChild className="hidden lg:flex h-9 px-3 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all">
              <Link to="/admin">
                <LayoutDashboard className="h-4 w-4 mr-1.5" />
                <span className="text-xs font-medium">Admin</span>
              </Link>
            </Button>
          )}

          {user && <div className="w-px h-5 bg-border/40 mx-1 hidden lg:block" />}

          {/* Theme toggle: desktop visible, mobile hidden (kept inside avatar dropdown) */}
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>

          {user ? (
            <DropdownMenu>
              {/* Avatar dropdown: desktop only. On mobile the avatar lives in BottomNav "You" tab. */}
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="hidden lg:flex p-0.5 h-9 w-9 rounded-full hover:bg-muted transition-all active:scale-90">
                  <Avatar className="h-7 w-7 ring-2 ring-border/30">
                    <AvatarImage src={userProfile?.profile_picture || ""} />
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                      {userProfile?.name?.charAt(0) || <UserIcon className="h-3 w-3" />}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 mt-2 p-1.5">
                {userProfile && (
                  <>
                    <div className="px-3 py-2">
                      <p className="font-semibold text-sm truncate">{userProfile.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                  <Link to="/profile">
                    <UserIcon className="h-4 w-4 mr-2" />
                    View Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                  <Link to="/leaderboard">
                    <Trophy className="h-4 w-4 mr-2" />
                    Leaderboard
                  </Link>
                </DropdownMenuItem>
                {/* Theme toggle for mobile (desktop has it inline in the navbar) */}
                <DropdownMenuItem
                  onClick={() => {
                    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
                    document.documentElement.classList.toggle('dark', next === 'dark');
                    localStorage.setItem('theme', next);
                  }}
                  className="lg:hidden rounded-lg cursor-pointer"
                >
                  <Moon className="h-4 w-4 mr-2 dark:hidden" />
                  <Sun className="h-4 w-4 mr-2 hidden dark:inline" />
                  Toggle theme
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild className="lg:hidden rounded-lg cursor-pointer">
                    <Link to="/admin">
                      <LayoutDashboard className="h-4 w-4 mr-2" />
                      Admin
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="rounded-lg text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm" className="h-8 rounded-full px-4 text-xs font-semibold bg-primary hover:bg-primary/90 transition-all">
              <Link to="/auth">Sign In</Link>
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
};
