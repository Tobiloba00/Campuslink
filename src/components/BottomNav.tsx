import { useNavigate, useLocation } from "react-router-dom";
import { Home, Search, Plus, MessageCircle, User } from "lucide-react";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: "/feed", icon: Home, label: "Home" },
    { path: "/user-search", icon: Search, label: "Search" },
    { path: "/create-post", icon: Plus, label: "Post", isCenter: true },
    { path: "/messages", icon: MessageCircle, label: "Messages" },
    { path: "/profile", icon: User, label: "Profile" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-border/50 lg:hidden safe-area-inset-bottom shadow-lg">
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 ${
              item.isCenter ? "relative" : ""
            }`}
          >
            {item.isCenter ? (
              <div className="flex items-center justify-center w-14 h-14 -mt-6 rounded-2xl bg-gradient-primary text-primary-foreground shadow-primary hover:shadow-lg transition-all duration-300 hover:scale-105 active:scale-95">
                <item.icon className="h-6 w-6" />
              </div>
            ) : (
              <div className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 ${
                isActive(item.path) ? "bg-primary/10" : "hover:bg-muted/50"
              }`}>
                <item.icon
                  className={`h-5 w-5 transition-all duration-300 ${
                    isActive(item.path) ? "text-primary scale-110" : "text-muted-foreground"
                  }`}
                />
                <span
                  className={`text-[10px] mt-1 font-semibold transition-colors ${
                    isActive(item.path) ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </span>
              </div>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
