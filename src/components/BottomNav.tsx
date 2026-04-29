import { useNavigate, useLocation } from "react-router-dom";
import { Home, Search, Plus, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const fetchUnread = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mountedRef.current) return;

      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .is('read_at', null);

      if (mountedRef.current) setUnreadCount(count || 0);
    };

    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mountedRef.current) return;

      const { data } = await supabase
        .from('profiles')
        .select('profile_picture, name')
        .eq('id', user.id)
        .single();

      if (mountedRef.current && data) {
        setProfilePicture(data.profile_picture);
        setProfileName(data.name);
      }
    };

    fetchUnread();
    fetchProfile();

    const channel = supabase
      .channel('bottomnav-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => fetchUnread())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => fetchUnread())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => fetchProfile())
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [location.pathname]);

  type NavItem = {
    path: string;
    icon: typeof Home;
    label: string;
    isCreate?: boolean;
    isProfile?: boolean;
    badge?: number;
  };

  const navItems: NavItem[] = [
    { path: "/feed", icon: Home, label: "Home" },
    { path: "/user-search", icon: Search, label: "Explore" },
    { path: "/create-post", icon: Plus, label: "Post", isCreate: true },
    { path: "/messages", icon: MessageCircle, label: "Chat", badge: unreadCount },
    { path: "/profile", icon: User, label: "You", isProfile: true },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      <div className="bg-background/95 backdrop-blur-md border-t border-border/30 safe-area-inset-bottom">
        <nav className="flex items-stretch justify-around max-w-md mx-auto h-14 px-2">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "relative flex flex-col items-center justify-center flex-1 gap-1 pt-1",
                  "transition-all duration-150",
                  "active:scale-90"
                )}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
              >
                <div className="relative">
                  {item.isCreate ? (
                    // Create button — special styling
                    <div className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center transition-colors duration-150",
                      active
                        ? "bg-primary text-white"
                        : "bg-muted/80 text-muted-foreground"
                    )}>
                      <Icon className="h-4 w-4" strokeWidth={2.5} />
                    </div>
                  ) : item.isProfile ? (
                    // Profile tab renders the user's actual avatar
                    <Avatar className={cn(
                      "h-[26px] w-[26px] transition-all duration-150",
                      active
                        ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                        : "ring-1 ring-border/40"
                    )}>
                      <AvatarImage src={profilePicture || ""} alt={profileName || "Profile"} />
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                        {profileName?.charAt(0).toUpperCase() || <Icon className="h-3.5 w-3.5" />}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <Icon
                      className={cn(
                        "h-[23px] w-[23px] transition-colors duration-150",
                        active ? "text-primary" : "text-muted-foreground/60"
                      )}
                      strokeWidth={active ? 2.2 : 1.7}
                    />
                  )}

                  {/* Unread badge */}
                  {item.badge != null && item.badge > 0 && (
                    <span className="absolute -top-1 -right-2.5 min-w-[16px] h-[16px] px-1 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full ring-2 ring-background">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>

                {!item.isCreate && (
                  <span className={cn(
                    "text-[10px] leading-none transition-colors duration-150",
                    active
                      ? "text-primary font-semibold"
                      : "text-muted-foreground/50 font-medium"
                  )}>
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </footer>
  );
};

export default BottomNav;
