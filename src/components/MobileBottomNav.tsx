import { memo } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Search, MessageCircle, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadCount } from "@/hooks/use-unread-count";

const navItems = [
  { key: "home", icon: Home, label: "Home", path: "/" },
  { key: "browse", icon: Search, label: "Search", path: "/search" },
  { key: "list", icon: Plus, label: "List", path: "/list-item", authRequired: true },
  { key: "messages", icon: MessageCircle, label: "Messages", path: "/messages", authRequired: true },
  { key: "profile", icon: User, label: "Profile", path: "/profile", authRequired: true },
];

const MobileBottomNav = memo(() => {
  const location = useLocation();
  const { user } = useAuth();
  const unreadCount = useUnreadCount();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/40 safe-area-bottom"
      role="navigation"
      aria-label="Mobile bottom navigation"
    >
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const path = item.authRequired && !user ? "/auth" : item.path;
          const isActive = item.path === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.key}
              to={path}
              className={cn(
                "relative flex flex-col items-center justify-center flex-1 h-full transition-colors min-w-[60px] min-h-[44px]",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              aria-label={`${item.label}${isActive ? ' (current)' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className="h-5 w-5 mb-0.5" aria-hidden="true" />
              {item.key === 'messages' && unreadCount > 0 && (
                <span className="absolute top-1 right-1/2 translate-x-3 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center shadow-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
});

MobileBottomNav.displayName = "MobileBottomNav";

export default MobileBottomNav;
