import { useLocation } from "react-router-dom";
import { PrefetchLink } from "@/components/PrefetchLink";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, Settings, DollarSign,
  Activity, Users, Flag, TicketPercent, AlertTriangle, Zap,
  ChevronLeft, Gauge, Package, CalendarCheck, CreditCard, Crown, Bug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";

const NAV_ITEMS = [
  { label: "Dashboard", icon: Gauge, path: "/admin" },
  { label: "Verifications", icon: ShieldCheck, path: "/admin/verifications" },
  { label: "Users", icon: Users, path: "/admin/users" },
  { label: "Manage Admins", icon: Crown, path: "/admin/manage-admins" },
  { label: "Listings", icon: Package, path: "/admin/listings" },
  { label: "Rentals", icon: CalendarCheck, path: "/admin/rentals" },
  { label: "Payments", icon: CreditCard, path: "/admin/payments" },
  { label: "Reports", icon: Flag, path: "/admin/reports" },
  { label: "Promo Codes", icon: TicketPercent, path: "/admin/promo-codes" },
  { label: "Payouts", icon: DollarSign, path: "/admin/payouts" },
  { label: "Disputes", icon: AlertTriangle, path: "/admin/disputes" },
  { label: "Automation", icon: Zap, path: "/admin/automation" },
  { label: "Errors", icon: Bug, path: "/admin/errors" },
  { label: "Health", icon: Activity, path: "/admin/health" },
  { label: "Settings", icon: Settings, path: "/admin/settings" },
];

export function AdminSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r bg-card transition-all duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div className="flex items-center justify-between p-3 border-b">
        {!collapsed && <span className="font-bold text-sm">Admin Panel</span>}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <nav className="p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = item.path === '/admin'
              ? location.pathname === '/admin'
              : location.pathname.startsWith(item.path);
            return (
              <PrefetchLink
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </PrefetchLink>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}
