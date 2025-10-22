import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Package, 
  Wallet, 
  MessageCircle, 
  User, 
  LogOut 
} from "lucide-react";

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MobileNav = ({ open, onOpenChange }: MobileNavProps) => {
  const { user, profile, signOut } = useAuth();

  const userInitials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: Package, label: "My Rentals", path: "/dashboard" },
    { icon: Wallet, label: "Wallet", path: "/wallet" },
    { icon: MessageCircle, label: "Messages", path: "/messages" },
    { icon: User, label: "Profile", path: "/profile" },
  ];

  const handleSignOut = async () => {
    await signOut();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] sm:w-[320px]">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>

        {/* User Profile Section */}
        {user && profile && (
          <div className="flex items-center gap-3 py-6 border-b">
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
        <nav className="flex flex-col gap-2 py-6">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors touch-target"
            >
              <item.icon className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Sign Out Button */}
        {user && (
          <div className="absolute bottom-6 left-4 right-4">
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default MobileNav;
