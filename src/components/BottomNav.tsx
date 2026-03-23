import { useNavigate, useLocation } from "react-router-dom";
import { Home, Search, PlusSquare, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread message count
  useEffect(() => {
    let mounted = true;

    const fetchUnread = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .is('read_at', null);

      if (mounted && count) setUnreadCount(count);
    };

    fetchUnread();

    // Listen for new messages
    const channel = supabase
      .channel('bottomnav-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchUnread();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => {
        fetchUnread();
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [location.pathname]); // Re-check when navigating

  const navItems = [
    { path: "/feed", icon: Home, label: "Home" },
    { path: "/user-search", icon: Search, label: "Explore" },
    { path: "/create-post", icon: PlusSquare, label: "Post" },
    { path: "/messages", icon: MessageCircle, label: "Chat", badge: unreadCount },
    { path: "/profile", icon: User, label: "Profile" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      {/* Solid background with subtle top border */}
      <div className="bg-background border-t border-border/40 safe-area-inset-bottom">
        <nav className="flex items-stretch justify-around max-w-lg mx-auto h-[52px]">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "relative flex flex-col items-center justify-center flex-1 gap-0.5",
                  "transition-colors duration-200",
                  "active:opacity-60"
                )}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
              >
                <div className="relative">
                  <Icon
                    className={cn(
                      "h-[22px] w-[22px] transition-colors duration-200",
                      active
                        ? "text-foreground"
                        : "text-muted-foreground/70"
                    )}
                    strokeWidth={active ? 2.5 : 1.8}
                    fill={active ? "currentColor" : "none"}
                  />

                  {/* Unread badge */}
                  {item.badge && item.badge > 0 && (
                    <span className={cn(
                      "absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center",
                      "bg-red-500 text-white text-[9px] font-bold rounded-full",
                      "ring-2 ring-background"
                    )}>
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>

                <span className={cn(
                  "text-[10px] leading-tight transition-colors duration-200",
                  active
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground/60 font-medium"
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </footer>
  );
};

export default BottomNav;
