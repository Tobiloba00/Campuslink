import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { GraduationCap, LogOut, User as UserIcon, MessageSquare, LayoutDashboard, Users } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Navbar = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

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
    const checkAdmin = async () => {
      if (!user) return;
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
    const fetchProfile = async () => {
      if (!user) return;
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

  return (
    <div className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none transition-all duration-500 animate-in slide-in-from-top-4">
      <nav className="pointer-events-auto h-14 glass-panel flex items-center justify-between px-6 max-w-5xl w-full border border-white/30 shadow-[0_20px_50px_rgba(0,0,0,0.2)] transition-all duration-500 hover:scale-[1.01] active:scale-[0.99] backdrop-blur-2xl">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="h-7 w-7 rounded-sm bg-gradient-primary flex items-center justify-center shadow-inner-glow transition-all duration-300 ease-spring group-hover:scale-110 group-hover:rotate-3">
            <GraduationCap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display font-semibold text-base tracking-tight hidden sm:inline-block">CampusLink</span>
        </Link>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild className="hidden md:flex h-8 px-2.5 rounded-xl hover:bg-primary/10 transition-colors">
                <Link to="/users">
                  <Users className="h-4 w-4 mr-1.5 text-primary" />
                  <span className="text-xs font-medium">Find Users</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild className="hidden md:flex h-8 px-2.5 rounded-xl hover:bg-primary/10 transition-colors">
                <Link to="/messages">
                  <MessageSquare className="h-4 w-4 mr-1.5 text-primary" />
                  <span className="text-xs font-medium">Messages</span>
                </Link>
              </Button>
              {isAdmin && (
                <Button variant="ghost" size="sm" asChild className="hidden md:flex h-8 px-2.5 rounded-xl hover:bg-primary/10 transition-colors">
                  <Link to="/admin">
                    <LayoutDashboard className="h-4 w-4 mr-1.5 text-primary" />
                    <span className="text-xs font-medium">Admin</span>
                  </Link>
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-0.5 h-8 w-8 rounded-full hover:bg-primary/10 transition-all active:scale-90">
                    <Avatar className="h-7 w-7 border border-primary/20">
                      <AvatarImage src={userProfile?.profile_picture || ""} />
                      <AvatarFallback className="text-[10px] bg-primary/10">
                        {userProfile?.name?.charAt(0) || <UserIcon className="h-3 w-3" />}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 glass-panel border-white/20 mt-2">
                  <DropdownMenuItem asChild className="rounded-xl focus:bg-primary/10">
                    <Link to="/profile">
                      <UserIcon className="h-4 w-4 mr-2" />
                      View Profile
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild className="md:hidden rounded-xl focus:bg-primary/10">
                      <Link to="/admin">
                        <LayoutDashboard className="h-4 w-4 mr-2" />
                        Admin
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleLogout} className="rounded-xl focus:bg-destructive/10 text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button asChild size="sm" className="h-8 rounded-xl px-4 text-xs font-semibold bg-gradient-primary shadow-lg hover:shadow-primary/20 transition-all hover:scale-105 active:scale-95">
              <Link to="/auth">Sign In</Link>
            </Button>
          )}
        </div>
      </nav>
    </div>
  );
};