import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { LogOut, User as UserIcon, MessageSquare, LayoutDashboard, Trophy, Home, Search } from "lucide-react";
import { Logo } from "@/components/Logo";
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
  const location = useLocation();
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
      className={`fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-2xl border-b border-border/30 transition-transform duration-300 ease-out ${
        navHidden ? '-translate-y-full' : 'translate-y-0'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <nav className="h-14 flex items-center justify-between px-4 sm:px-6 max-w-6xl w-full mx-auto relative">

        {/* Left — Logo icon on mobile, Logo + text on desktop */}
        <Link to={user ? "/feed" : "/"} className="z-10 flex items-center">
          <div className="lg:hidden">
            <Logo size={28} />
          </div>
          <div className="hidden lg:block">
            <Logo size={34} showText textClassName="text-base" />
          </div>
        </Link>

        {/* Center — Wordmark on mobile only */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none lg:hidden">
          <span className="font-display font-extrabold text-[17px] tracking-tight text-foreground">
            CampusLink
          </span>
        </div>

        {/* Right — Actions */}
        <div className="flex items-center gap-1 z-10">
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

          <ThemeToggle />

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="p-0.5 h-9 w-9 rounded-full hover:bg-muted transition-all active:scale-90">
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
