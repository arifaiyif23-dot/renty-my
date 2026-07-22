import { useCallback, useRef } from "react";

const pageModules = {
  verification: () => import("@/pages/Verification"),
  earnings: () => import("@/pages/Earnings"),
  disputes: () => import("@/pages/Disputes"),
  help: () => import("@/pages/Help"),
  terms: () => import("@/pages/Terms"),
  privacy: () => import("@/pages/Privacy"),
  vendorOnboarding: () => import("@/pages/VendorOnboarding"),
  notificationSettings: () => import("@/pages/NotificationSettings"),
  savedSearches: () => import("@/pages/SavedSearches"),
  userProfile: () => import("@/pages/UserProfile"),
  adminDashboard: () => import("@/pages/AdminDashboard"),
  adminUsers: () => import("@/pages/AdminUsers"),
  adminListings: () => import("@/pages/AdminListings"),
  adminRentals: () => import("@/pages/AdminRentals"),
  adminVerification: () => import("@/pages/AdminVerification"),
  adminPayouts: () => import("@/pages/AdminPayouts"),
  adminDisputes: () => import("@/pages/AdminDisputes"),
  adminReports: () => import("@/pages/AdminReports"),
  adminPromoCodes: () => import("@/pages/AdminPromoCodes"),
  adminSettings: () => import("@/pages/AdminSettings"),
  adminAutomation: () => import("@/pages/AdminAutomation"),
  adminHealth: () => import("@/pages/AdminHealth"),
  adminUserDetail: () => import("@/pages/AdminUserDetail"),
  paymentSuccess: () => import("@/pages/PaymentSuccess"),
  install: () => import("@/pages/Install"),
  offline: () => import("@/pages/Offline"),
  pwaSettings: () => import("@/pages/PWASettings"),
};

type PageName = keyof typeof pageModules;

export function usePrefetch() {
  const prefetched = useRef(new Set<PageName>());

  const prefetch = useCallback((name: PageName) => {
    if (prefetched.current.has(name)) return;
    prefetched.current.add(name);
    const importer = pageModules[name];
    if (importer) {
      importer().catch(() => {});
    }
  }, []);

  return prefetch;
}

export function prefetchRoutes(pages: PageName[]) {
  pages.forEach((name) => {
    const importer = pageModules[name];
    if (importer) {
      importer().catch(() => {});
    }
  });
}
