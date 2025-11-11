import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { User, Menu, Search, Heart, MessageSquare, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/renty-main-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileNav from "@/components/MobileNav";
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

import { supabase } from "@/integrations/supabase/client";

const Header = () => {
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  const userInitials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  // Check admin status using server-side verification
  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    const checkAdminStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('verify-admin');
        setIsAdmin(!error && data?.isAdmin === true);
      } catch (error) {
        console.error('Admin verification error:', error);
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  // Fetch unread message count
  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);
      
      setUnreadCount(count || 0);
    };

    fetchUnreadCount();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('unread-messages')
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 md:h-16 items-center justify-between gap-2">
            {/* Mobile Menu Button + Logo */}
            <div className="flex items-center gap-2">
              {isMobile && user && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden min-h-[44px] min-w-[44px]"
                  onClick={() => setMobileNavOpen(true)}
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <Link to="/" className="flex items-center" aria-label="Go to RENTY homepage">
                <img src={logo} alt="RENTY - Malaysia's Rental Marketplace" className="h-8 md:h-10 w-auto" loading="eager" />
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/search" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                {t('nav.browse')}
              </Link>
              {user && (
                <>
                  <Link to="/dashboard" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                    {t('nav.myRentals')}
                  </Link>
                  <Link to="/messages" className="text-sm font-medium text-foreground hover:text-primary transition-colors relative">
                    Messages
                    {unreadCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                      >
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Badge>
                    )}
                  </Link>
                  <Link to="/wishlist" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                    {t('nav.wishlist')}
                  </Link>
                </>
              )}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              <LanguageSwitcher />
              {user ? (
                <>
                  <NotificationBell />
                  
                  {/* Search Icon (Mobile) */}
                  {isMobile && (
                    <Link to="/search">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="md:hidden min-h-[44px] min-w-[44px]"
                        aria-label="Search items"
                      >
                        <Search className="h-5 w-5" />
                      </Button>
                    </Link>
                  )}

                  {/* Desktop List Item Button */}
                  <Link to="/list-item" className="hidden md:inline-flex">
                    <Button size="sm">
                      {t('listItem.title')}
                    </Button>
                  </Link>

                  {/* Desktop User Menu */}
                  {!isMobile && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-full min-h-[44px] min-w-[44px]"
                          aria-label="Open user menu"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={profile?.avatar_url} alt={profile?.full_name || 'User avatar'} />
                            <AvatarFallback>{userInitials}</AvatarFallback>
                          </Avatar>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem asChild>
                          <Link to="/profile" className="flex items-center cursor-pointer">
                            <User className="h-4 w-4 mr-2" />
                            {t('nav.profile')}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/wishlist" className="flex items-center cursor-pointer">
                            <Heart className="h-4 w-4 mr-2" />
                            {t('nav.wishlist')}
                          </Link>
                        </DropdownMenuItem>
                        {isAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link to="/admin/verifications" className="flex items-center cursor-pointer">
                                <Shield className="h-4 w-4 mr-2" />
                                Admin: Verifications
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to="/admin/payments" className="flex items-center cursor-pointer">
                                <Shield className="h-4 w-4 mr-2" />
                                Admin: Payments
                              </Link>
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer">
                          {t('nav.signOut')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </>
              ) : (
                <Link to="/auth">
                  <Button variant="outline" size="sm">
                    <User className="h-4 w-4 mr-0 sm:mr-2" />
                    <span className="hidden sm:inline">{t('nav.signIn')}</span>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
    </>
  );
};

export default Header;
