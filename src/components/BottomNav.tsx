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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border lg:hidden safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-all ${
              item.isCenter ? "" : ""
            }`}
          >
            {item.isCenter ? (
              <div className="flex items-center justify-center w-12 h-12 -mt-4 rounded-full bg-primary text-primary-foreground shadow-lg">
                <item.icon className="h-6 w-6" />
              </div>
            ) : (
              <>
                <item.icon
                  className={`h-5 w-5 transition-colors ${
                    isActive(item.path) ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <span
                  className={`text-[10px] mt-1 font-medium transition-colors ${
                    isActive(item.path) ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </span>
              </>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
