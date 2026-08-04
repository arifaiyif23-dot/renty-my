import { Link, useLocation } from "react-router-dom";
import { Home, Search, MessageCircle, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const MobileBottomNav = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    let cancelled = false;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);
      if (!cancelled) setUnreadCount(count ?? 0);
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user, location.pathname]);

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
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);
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
                  "bg-primary shadow-3",
                  isActive && "bg-primary/90"
                )}>
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </div>
              ) : (
                <>
                  <item.icon className="h-5 w-5 mb-0.5" aria-hidden="true" />
                  {item.key === 'messages' && unreadCount > 0 && (
                    <span className="absolute top-1 right-1/2 translate-x-3 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center shadow-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </>
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
