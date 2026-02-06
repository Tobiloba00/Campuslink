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
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      {/* Glass background with blur */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-t border-border/30" />
      
      {/* Safe area padding for notched devices */}
      <div className="relative flex items-center justify-around h-16 px-2 max-w-lg mx-auto pb-safe">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "relative flex flex-col items-center justify-center flex-1 h-full",
                "transition-all duration-200 ease-out",
                "active:scale-95"
              )}
            >
              {/* Active indicator dot */}
              <div className={cn(
                "absolute top-1 w-1 h-1 rounded-full transition-all duration-200",
                active ? "bg-primary scale-100" : "scale-0"
              )} />
              
              {/* Icon */}
              <Icon 
                className={cn(
                  "h-6 w-6 transition-all duration-200",
                  active 
                    ? "text-primary" 
                    : "text-muted-foreground"
                )}
                strokeWidth={active ? 2.5 : 1.5}
              />
              
              {/* Label - only show on active */}
              <span className={cn(
                "text-[10px] font-medium mt-0.5 transition-all duration-200",
                active 
                  ? "text-primary opacity-100" 
                  : "text-muted-foreground opacity-0 h-0"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
