import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { User, Menu, LogOut, Plus, Home, Search, MessageCircle, LayoutDashboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import MobileNav from "@/components/MobileNav";
import { SearchBarV2 } from "@/components/SearchBarV2";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/NotificationBell";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { haptics } from "@/utils/haptics";
import { cn } from "@/lib/utils";

import { supabase } from "@/integrations/supabase/client";

const desktopNavLinks = [
  { key: "home", icon: Home, label: "Home", path: "/" },
  { key: "browse", icon: Search, label: "Browse", path: "/search" },
  { key: "messages", icon: MessageCircle, label: "Messages", path: "/messages", auth: true },
  { key: "dashboard", icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", auth: true },
];

const Header = () => {
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  const handleSignOut = () => {
    haptics.medium();
    setShowSignOutDialog(true);
  };

  const confirmSignOut = async () => {
    haptics.success();
    await signOut();
    setShowSignOutDialog(false);
  };

  const userInitials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', user.id)
          .eq('is_read', false);
        if (error) throw error;
        setUnreadCount(count || 0);
      } catch (err) {
        console.error('Failed to fetch unread count:', err);
      }
    };

    fetchUnreadCount();

    const channel = supabase
      .channel(`unread-messages-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Unread messages channel error');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/50 glass">
        <div className="mx-auto px-4 lg:px-8 max-w-7xl">
          <div className="flex h-14 md:h-16 items-center justify-between gap-2 md:gap-6">
            <div className="flex items-center gap-2 shrink-0">
              {isMobile && user && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setMobileNavOpen(true)}
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <Link to="/" className="flex items-center" aria-label="Renty homepage">
                <img src="/logo-light.png" alt="Renty" className="h-7 md:h-8 w-auto dark:hidden" />
                <img src="/logo-dark.png" alt="Renty" className="h-7 md:h-8 w-auto hidden dark:block" />
              </Link>
            </div>

            {/* Desktop marketplace search — mobile search lives in the bottom nav / hero */}
            <div className="hidden md:block flex-1 max-w-md lg:max-w-lg">
              <SearchBarV2 variant="inline" />
            </div>

            <nav className="hidden md:flex items-center gap-1 shrink-0" role="navigation" aria-label="Main navigation">
              {desktopNavLinks.map((link) => {
                if (link.auth && !user) return null;
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.key}
                    to={link.path}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : link.highlight
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {link.highlight ? null : <link.icon className="h-4 w-4" />}
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
              <LanguageSwitcher />
              {user ? (
                <>
                  <NotificationBell />
                  <Link to="/list-item" className="hidden md:inline-flex mr-1">
                    <Button className="gap-1.5 shadow-1">
                      <Plus className="h-4 w-4" />
                      {t('listItem.title')}
                    </Button>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={profile?.avatar_url} alt={profile?.full_name || 'User'} />
                          <AvatarFallback>{userInitials}</AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem asChild>
                        <Link to="/dashboard" className="cursor-pointer">My Rentals</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/messages" className="cursor-pointer">
                          Messages
                          {unreadCount > 0 && (
                            <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-[10px]">
                              {unreadCount > 9 ? '9+' : unreadCount}
                            </Badge>
                          )}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/wishlist" className="cursor-pointer">Saved</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/profile" className="cursor-pointer">Profile</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                        <LogOut className="h-4 w-4 mr-2" />
                        {t('nav.signOut')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <Link to="/auth">
                  <Button variant="outline" size="sm">
                    <User className="h-4 w-4 mr-1.5" />
                    Sign in
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />

      <AlertDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('nav.signOutConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('nav.signOutConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSignOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('nav.signOut')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Header;
