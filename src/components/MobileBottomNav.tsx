import { Link, useLocation } from "react-router-dom";
import { Home, Search, MessageCircle, User, Plus, Bell, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from 'react-i18next';

const MobileBottomNav = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();
  
  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Search, label: "Browse", path: "/search" },
  ];

  const rightNavItems = [
    { icon: MessageCircle, label: "Messages", path: "/messages" },
    { icon: User, label: "Profile", path: user ? "/profile" : "/auth" },
  ];

  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t safe-area-bottom"
      role="navigation"
      aria-label="Mobile bottom navigation"
    >
      <div className="flex items-center justify-around h-16 px-1">
        {/* Left Nav Items */}
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full transition-colors min-w-[60px] min-h-[44px]",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              aria-label={`${item.label} - ${isActive ? 'current page' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className="h-5 w-5 mb-1" aria-hidden="true" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
        
        {/* Central FAB for List Item */}
        <div className="flex-1 flex justify-center min-w-[60px]">
          <Link to={user ? "/list-item" : "/auth"} aria-label="List a new item">
            <Button
              size="icon"
              className="h-14 w-14 rounded-full shadow-lg -mt-8"
              aria-label="List a new item"
            >
              <Plus className="h-6 w-6" aria-hidden="true" />
            </Button>
          </Link>
        </div>
        
        {/* Right Nav Items */}
        {rightNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full transition-colors min-w-[60px] min-h-[44px]",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              aria-label={`${item.label} - ${isActive ? 'current page' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className="h-5 w-5 mb-1" aria-hidden="true" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
