import { Link, useLocation } from "react-router-dom";
import { Home, Search, MessageCircle, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const MobileBottomNav = () => {
  const location = useLocation();
  const { user } = useAuth();

  const navItems = [
    { key: "home", icon: Home, label: "Home", path: "/" },
    { key: "browse", icon: Search, label: "Browse", path: "/search" },
    { key: "list", icon: Plus, label: "List", path: user ? "/list-item" : "/auth", highlight: true },
    { key: "messages", icon: MessageCircle, label: "Messages", path: user ? "/messages" : "/auth" },
    { key: "profile", icon: User, label: "Profile", path: user ? "/profile" : "/auth" },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-elevated border-t-0 safe-area-bottom"
      role="navigation"
      aria-label="Mobile bottom navigation"
    >
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.key}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full transition-colors min-w-[60px] min-h-[44px] relative",
                isActive
                  ? item.highlight ? "text-white" : "text-primary"
                  : item.highlight ? "text-primary" : "text-muted-foreground"
              )}
              aria-label={`${item.label}${isActive ? ' (current)' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.highlight ? (
                <div className={cn(
                  "absolute inset-0 mx-auto w-12 h-12 rounded-full flex items-center justify-center -mt-5",
                  "bg-primary shadow-lg",
                  isActive && "bg-primary/90"
                )}>
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </div>
              ) : (
                <item.icon className="h-5 w-5 mb-0.5" aria-hidden="true" />
              )}
              {!item.highlight && (
                <span className="text-[10px] font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
