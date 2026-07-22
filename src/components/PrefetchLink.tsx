import { Link } from "react-router-dom";
import type { ComponentProps } from "react";
import { usePrefetch } from "@/hooks/use-prefetch";

const pageNameByPath: Record<string, Parameters<ReturnType<typeof usePrefetch>>[0]> = {
  "/verification": "verification",
  "/earnings": "earnings",
  "/disputes": "disputes",
  "/help": "help",
  "/terms": "terms",
  "/privacy": "privacy",
  "/vendor-onboarding": "vendorOnboarding",
  "/notification-settings": "notificationSettings",
  "/saved-searches": "savedSearches",
  "/payment-success": "paymentSuccess",
  "/install": "install",
  "/offline": "offline",
  "/pwa-settings": "pwaSettings",
  "/admin": "adminDashboard",
  "/admin/users": "adminUsers",
  "/admin/listings": "adminListings",
  "/admin/rentals": "adminRentals",
  "/admin/payments": "adminPayments",
  "/admin/verifications": "adminVerification",
  "/admin/payouts": "adminPayouts",
  "/admin/disputes": "adminDisputes",
  "/admin/reports": "adminReports",
  "/admin/promo-codes": "adminPromoCodes",
  "/admin/settings": "adminSettings",
  "/admin/automation": "adminAutomation",
  "/admin/health": "adminHealth",
};

type PrefetchLinkProps = ComponentProps<typeof Link> & {
  prefetchOnHover?: boolean;
};

export function PrefetchLink({ prefetchOnHover = true, ...props }: PrefetchLinkProps) {
  const prefetch = usePrefetch();

  const handleMouseEnter = () => {
    if (!prefetchOnHover) return;
    const to = typeof props.to === "string" ? props.to : "";
    const pageName = pageNameByPath[to];
    if (pageName) {
      prefetch(pageName);
    }
  };

  return <Link {...props} onMouseEnter={handleMouseEnter} />;
}
