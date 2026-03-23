import { useNavigate, useLocation } from "react-router-dom";
import { Home, Search, Plus, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: "/feed", icon: Home, label: "Home" },
    { path: "/user-search", icon: Search, label: "Search" },
    { path: "/create-post", icon: Plus, label: "Post" },
    { path: "/messages", icon: MessageCircle, label: "Messages" },
    { path: "/profile", icon: User, label: "Profile" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/85 backdrop-blur-2xl border-t border-white/10 dark:border-white/5 safe-area-inset-bottom">
      <div className="px-4 py-2.5 flex items-center justify-around relative max-w-lg mx-auto">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          const isCenter = item.label === "Post";

          if (isCenter) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="relative flex items-center justify-center -mt-5 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/30 h-12 w-12 hover:scale-105 active:scale-95 transition-all duration-300 ring-4 ring-background"
              >
                <Icon className="h-6 w-6 text-white" strokeWidth={2.5} />
              </button>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "relative flex flex-col items-center justify-center flex-1 h-full py-1",
                "transition-all duration-300 ease-out",
                "active:scale-95 hover:opacity-80"
              )}
            >
              {/* Active Glow behind icon */}
              <div className={cn(
                "absolute bg-primary/20 blur-md rounded-full w-8 h-8 transition-opacity duration-300",
                active ? "opacity-100" : "opacity-0"
              )} />

              <Icon
                className={cn(
                  "h-[22px] w-[22px] transition-all duration-300 relative z-10",
                  active
                    ? "text-primary -translate-y-1"
                    : "text-muted-foreground"
                )}
                strokeWidth={active ? 2.5 : 2}
              />

              {/* Active Dot indicator */}
              <div className={cn(
                "absolute bottom-0 w-1 h-1 rounded-full transition-all duration-300 bg-primary",
                active ? "scale-100 opacity-100" : "scale-0 opacity-0 translate-y-2"
              )} />
            </button>
          );
        })}
      </div>
    </footer>
  );
};

export default BottomNav;
