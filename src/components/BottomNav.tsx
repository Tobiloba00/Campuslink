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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-[12px] border-t border-border/50 lg:hidden safe-area-inset-bottom">
      <div className="flex items-center justify-around h-14 px-2 max-w-lg mx-auto">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 ease-smooth ${
              item.isCenter ? "relative" : ""
            }`}
          >
            {item.isCenter ? (
              <div className="flex items-center justify-center w-11 h-11 -mt-5 rounded-md bg-gradient-primary text-primary-foreground shadow-inner-glow transition-transform duration-200 ease-spring hover:scale-105 active:scale-95">
                <item.icon className="h-5 w-5" />
              </div>
            ) : (
              <div className={`flex flex-col items-center justify-center p-1.5 rounded transition-colors duration-200 ${
                isActive(item.path) ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}>
                <item.icon className={`h-5 w-5 transition-transform duration-200 ${
                  isActive(item.path) ? "scale-105" : ""
                }`} />
                <span className={`text-[10px] mt-0.5 font-medium ${
                  isActive(item.path) ? "text-primary" : ""
                }`}>
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