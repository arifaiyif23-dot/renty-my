import { useState, memo, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { User, Menu, LogOut, Plus, Home, Search, MessageCircle, LayoutDashboard, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { useUnreadCount } from "@/hooks/use-unread-count";

const desktopNavLinks = [
  { key: "home", icon: Home, label: "Home", path: "/" },
  { key: "browse", icon: Search, label: "Browse", path: "/search" },
  { key: "about", icon: Info, label: "About", path: "/about" },
  { key: "messages", icon: MessageCircle, label: "Messages", path: "/messages", auth: true },
  { key: "dashboard", icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", auth: true },
];

const Header = memo(() => {
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const unreadCount = useUnreadCount();

  const handleSignOut = useCallback(() => {
    haptics.medium();
    setShowSignOutDialog(true);
  }, []);

  const confirmSignOut = useCallback(async () => {
    haptics.success();
    await signOut();
    setShowSignOutDialog(false);
  }, [signOut]);

  const userInitials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-card border-b border-border/40 safe-area-top">
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
                <img src="/logo-light.png" alt="Renty" className="h-7 md:h-8 w-auto" />
              </Link>
            </div>

            <div className="hidden md:block flex-1 max-w-md lg:max-w-lg">
              <SearchBarV2 variant="inline" />
            </div>

            <nav className="hidden md:flex items-center gap-1 shrink-0" role="navigation" aria-label="Main navigation">
              {desktopNavLinks.map((link) => {
                if (link.auth && !user) return null;
                const isActive = link.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(link.path);
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
                        <Link to="/dashboard" className="cursor-pointer">{t('nav.myRentals')}</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/messages" className="cursor-pointer">
                          {t('nav.messages')}
                          {unreadCount > 0 && (
                            <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-[10px]">
                              {unreadCount > 9 ? '9+' : unreadCount}
                            </Badge>
                          )}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/wishlist" className="cursor-pointer">{t('nav.saved')}</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/profile" className="cursor-pointer">{t('nav.profile')}</Link>
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
                    {t('nav.signIn')}
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
});

Header.displayName = "Header";

export default Header;
