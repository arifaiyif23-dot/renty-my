import { Link } from "react-router-dom";
import { PrefetchLink } from "@/components/PrefetchLink";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Package,
  TrendingUp,
  MessageCircle,
  User,
  ShieldCheck,
  Heart,
  LogOut,
  FileText,
  HelpCircle,
} from "lucide-react";

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MobileNav = ({ open, onOpenChange }: MobileNavProps) => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const userInitials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  const navItems: { icon: React.ComponentType<{ className?: string }>; label: string; path: string; prefetch?: boolean }[] = [
    { icon: LayoutDashboard, label: t('nav.dashboard'), path: "/dashboard" },
    { icon: Package, label: t('nav.myListings'), path: "/my-listings" },
    { icon: TrendingUp, label: t('nav.myEarnings'), path: "/earnings", prefetch: true },
    { icon: MessageCircle, label: t('nav.messages'), path: "/messages" },
    { icon: Heart, label: t('nav.wishlist'), path: "/wishlist" },
    { icon: ShieldCheck, label: t('nav.verification'), path: "/verification" },
    { icon: User, label: t('nav.profile'), path: "/profile" },
  ];

  const footerLinks = [
    { icon: HelpCircle, label: t('footer.helpCenter'), path: "/help" },
    { icon: FileText, label: t('footer.termsOfService'), path: "/terms" },
    { icon: FileText, label: t('footer.privacyPolicy'), path: "/privacy" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[85vw] max-w-[320px] flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 pt-6 pb-0">
          <SheetTitle>{t('nav.menu')}</SheetTitle>
        </SheetHeader>

        {/* User Profile Section */}
        {user && profile && (
          <div className="flex items-center gap-3 px-6 py-6 border-b">
            <Avatar className="h-12 w-12">
              <AvatarImage src={profile.avatar_url} />
              <AvatarFallback className="text-lg">{userInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{profile.full_name}</p>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <div className="flex flex-col flex-1 min-h-0">
          <nav className="flex flex-col gap-2 py-6 overflow-y-auto px-6">
            {navItems.map((item) => {
              const NavLink = item.prefetch ? PrefetchLink : Link;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-accent active:scale-[0.98] transition-all"
                >
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Footer Links */}
          <div className="border-t px-6 py-4">
            {footerLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-accent transition-colors text-sm text-muted-foreground"
              >
                <link.icon className="h-4 w-4" />
                <span>{link.label}</span>
              </Link>
            ))}
          </div>

          {/* Sign Out */}
          <div className="border-t px-6 py-4 mt-auto">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-4 py-3 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={async () => {
                onOpenChange(false);
                await signOut();
                navigate('/auth');
              }}
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">{t('nav.signOut')}</span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileNav;
