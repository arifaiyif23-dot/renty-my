import { Suspense, lazy, useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import MobileBottomNav from "@/components/MobileBottomNav";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { AdminRoute } from "@/components/AdminRoute";
import { useScrollToTop } from "@/hooks/use-scroll-to-top";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import PageTransition from "@/components/PageTransition";
import { isNative } from "@/lib/platform";

// Eager load critical pages (landing + auth)
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthMagicLink from "./pages/AuthMagicLink";

// Lazy load all other pages to reduce main chunk size and prevent TDZ errors
const Search = lazy(() => import("./pages/Search"));
const ItemDetail = lazy(() => import("./pages/ItemDetail"));
const Profile = lazy(() => import("./pages/Profile"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MyListings = lazy(() => import("./pages/MyListings"));
const Messages = lazy(() => import("./pages/Messages"));
const ListItem = lazy(() => import("./pages/ListItem"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Verification = lazy(() => import("./pages/Verification"));
const AdminVerification = lazy(() => import("./pages/AdminVerification"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const Install = lazy(() => import("./pages/Install"));
const Offline = lazy(() => import("./pages/Offline"));
const PWASettings = lazy(() => import("./pages/PWASettings"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const Earnings = lazy(() => import("./pages/Earnings"));
const AdminPayouts = lazy(() => import("./pages/AdminPayouts"));
const AdminAutomation = lazy(() => import("./pages/AdminAutomation"));
const AdminHealth = lazy(() => import("./pages/AdminHealth"));
const AdminDisputes = lazy(() => import("./pages/AdminDisputes"));
const Disputes = lazy(() => import("./pages/Disputes"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const VendorOnboarding = lazy(() => import("./pages/VendorOnboarding"));
const Help = lazy(() => import("./pages/Help"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const SavedSearches = lazy(() => import("./pages/SavedSearches"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const AdminPromoCodes = lazy(() => import("./pages/AdminPromoCodes"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const AdminListings = lazy(() => import("./pages/AdminListings"));
const AdminRentals = lazy(() => import("./pages/AdminRentals"));
const AdminPayments = lazy(() => import("./pages/AdminPayments"));
const AdminUserDetail = lazy(() => import("./pages/AdminUserDetail"));
const AdminManageAdmins = lazy(() => import("./pages/AdminManageAdmins"));
const AdminErrors = lazy(() => import("./pages/AdminErrors"));
const BookingDetail = lazy(() => import("./pages/BookingDetail"));
const RentalAgreement = lazy(() => import("./pages/RentalAgreement"));
const PaymentDetail = lazy(() => import("./pages/PaymentDetail"));
const RentalDetail = lazy(() => import("./pages/RentalDetail"));
const ReviewPage = lazy(() => import("./pages/ReviewPage"));
const About = lazy(() => import("./pages/About"));

function AppRoutes() {
  useScrollToTop();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;
    import('@capacitor/app').then(({ App }) => {
      if (cancelled) return;
      App.addListener('appUrlOpen', (data) => {
        try {
          const url = new URL(data.url);
          if (url.pathname === '/payment-success') {
            navigate(`/payment-success${url.search}`);
          } else if (url.pathname === '/auth') {
            navigate(`/auth${url.search}${url.hash}`);
          }
        } catch {
          // Ignore malformed URLs
        }
      });
    });
    return () => { cancelled = true; };
  }, [navigate]);
  
  return (
    <>
      <OfflineIndicator />
      <PWAInstallPrompt />
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>
      <Suspense fallback={<LoadingSpinner />}>
        <PageTransition key={location.pathname}>
          <Routes>
            <Route path="/" element={<ErrorBoundary><Index /></ErrorBoundary>} />
            <Route path="/auth" element={<ErrorBoundary><Auth /></ErrorBoundary>} />
            <Route path="/auth/magic" element={<ErrorBoundary><AuthMagicLink /></ErrorBoundary>} />
            <Route path="/about" element={<ErrorBoundary><About /></ErrorBoundary>} />
            <Route path="/install" element={<ErrorBoundary><Install /></ErrorBoundary>} />
            <Route path="/dashboard" element={<ErrorBoundary><ProtectedRoute><Dashboard /></ProtectedRoute></ErrorBoundary>} />
            <Route path="/list-item" element={<ErrorBoundary><ProtectedRoute><ListItem /></ProtectedRoute></ErrorBoundary>} />
            <Route path="/vendor-onboarding" element={<ErrorBoundary><ProtectedRoute><VendorOnboarding /></ProtectedRoute></ErrorBoundary>} />
            <Route path="/items/:id" element={<ErrorBoundary><ItemDetail /></ErrorBoundary>} />
            <Route path="/search" element={<ErrorBoundary><Search /></ErrorBoundary>} />
            <Route path="/messages" element={<ErrorBoundary><ProtectedRoute><Messages /></ProtectedRoute></ErrorBoundary>} />
            <Route path="/profile" element={<ErrorBoundary><ProtectedRoute><Profile /></ProtectedRoute></ErrorBoundary>} />
            <Route path="/wishlist" element={<ErrorBoundary><ProtectedRoute><Wishlist /></ProtectedRoute></ErrorBoundary>} />
            <Route path="/my-listings" element={<ErrorBoundary><ProtectedRoute><MyListings /></ProtectedRoute></ErrorBoundary>} />
            <Route path="/verification" element={<ErrorBoundary><ProtectedRoute><Verification /></ProtectedRoute></ErrorBoundary>} />
            <Route path="/payment-success" element={<ErrorBoundary><PaymentSuccess /></ErrorBoundary>} />
            <Route path="/earnings" element={<ErrorBoundary><ProtectedRoute><Earnings /></ProtectedRoute></ErrorBoundary>} />
            <Route path="/admin" element={<ErrorBoundary><ProtectedRoute><AdminRoute><AdminDashboard /></AdminRoute></ProtectedRoute></ErrorBoundary>} />
            <Route path="/admin/payouts" element={<ErrorBoundary><ProtectedRoute><AdminRoute><AdminPayouts /></AdminRoute></ProtectedRoute></ErrorBoundary>} />
            <Route path="/admin/verifications" element={<ErrorBoundary><ProtectedRoute><AdminRoute><AdminVerification /></AdminRoute></ProtectedRoute></ErrorBoundary>} />
            <Route path="/admin/settings" element={<ErrorBoundary><ProtectedRoute><AdminRoute><AdminSettings /></AdminRoute></ProtectedRoute></ErrorBoundary>} />
            <Route path="/admin/automation" element={<ErrorBoundary><ProtectedRoute><AdminRoute><AdminAutomation /></AdminRoute></ProtectedRoute></ErrorBoundary>} />
            <Route path="/admin/health" element={<ErrorBoundary><ProtectedRoute><AdminRoute><AdminHealth /></AdminRoute></ProtectedRoute></ErrorBoundary>} />
            <Route path="/admin/disputes" element={<ErrorBoundary><ProtectedRoute><AdminRoute><AdminDisputes /></AdminRoute></ProtectedRoute></ErrorBoundary>} />
            <Route path="/admin/users" element={<ErrorBoundary><ProtectedRoute><AdminRoute><AdminUsers /></AdminRoute></ProtectedRoute></ErrorBoundary>} />
            <Route path="/admin/reports" element={<ErrorBoundary><ProtectedRoute><AdminRoute><AdminReports /></AdminRoute></ProtectedRoute></ErrorBoundary>} />
            <Route path="/admin/promo-codes" element={<ErrorBoundary><ProtectedRoute><AdminRoute><AdminPromoCodes /></AdminRoute></ProtectedRoute></ErrorBoundary>} />
            <Route path="/admin/listings" element={<ErrorBoundary><ProtectedRoute><AdminRoute><AdminListings /></AdminRoute></ProtectedRoute></ErrorBoundary>} />
            <Route path="/admin/rentals" element={<ErrorBoundary><ProtectedRoute><AdminRoute><AdminRentals /></AdminRoute></ProtectedRoute></ErrorBoundary>} />
            <Route path="/admin/payments" element={<ErrorBoundary><ProtectedRoute><AdminRoute><AdminPayments /></AdminRoute></ProtectedRoute></ErrorBoundary>} />
            <Route path="/admin/users/:id" element={<ErrorBoundary><ProtectedRoute><AdminRoute><AdminUserDetail /></AdminRoute></ProtectedRoute></ErrorBoundary>} />
            <Route path="/admin/manage-admins" element={<ErrorBoundary><ProtectedRoute><AdminRoute><AdminManageAdmins /></AdminRoute></ProtectedRoute></ErrorBoundary>} />
            <Route path="/admin/errors" element={<ErrorBoundary><ProtectedRoute><AdminRoute><AdminErrors /></AdminRoute></ProtectedRoute></ErrorBoundary>} />
            <Route path="/users/:id" element={<ErrorBoundary><UserProfile /></ErrorBoundary>} />
            <Route path="/disputes" element={<ErrorBoundary><ProtectedRoute><Disputes /></ProtectedRoute></ErrorBoundary>} />
            <Route path="/help" element={<ErrorBoundary><Help /></ErrorBoundary>} />
            <Route path="/notification-settings" element={<ErrorBoundary><ProtectedRoute><NotificationSettings /></ProtectedRoute></ErrorBoundary>} />
            <Route path="/saved-searches" element={<ErrorBoundary><ProtectedRoute><SavedSearches /></ProtectedRoute></ErrorBoundary>} />
            <Route path="/pwa-settings" element={<ErrorBoundary><PWASettings /></ErrorBoundary>} />
            <Route path="/offline" element={<ErrorBoundary><Offline /></ErrorBoundary>} />
            <Route path="/terms" element={<ErrorBoundary><Terms /></ErrorBoundary>} />
            <Route path="/privacy" element={<ErrorBoundary><Privacy /></ErrorBoundary>} />
            <Route path="/booking/:id" element={<ErrorBoundary><ProtectedRoute><BookingDetail /></ProtectedRoute></ErrorBoundary>} />
            <Route path="/booking/:id/agreement" element={<ErrorBoundary><ProtectedRoute><RentalAgreement /></ProtectedRoute></ErrorBoundary>} />
            <Route path="/payment/:id" element={<ErrorBoundary><ProtectedRoute><PaymentDetail /></ProtectedRoute></ErrorBoundary>} />
            <Route path="/rental/:id" element={<ErrorBoundary><ProtectedRoute><RentalDetail /></ProtectedRoute></ErrorBoundary>} />
            <Route path="/review/:rentalId" element={<ErrorBoundary><ProtectedRoute><ReviewPage /></ProtectedRoute></ErrorBoundary>} />
            <Route path="*" element={<ErrorBoundary><NotFound /></ErrorBoundary>} />
          </Routes>
        </PageTransition>
      </Suspense>
      <MobileBottomNav />
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    {/* ThemeProvider is set up in main.tsx with next-themes. Dark mode CSS variables are defined in index.css.
        The theme toggle in Header is functional. If dark mode contrast issues arise, adjust `.dark` CSS variables in index.css. */}
    <ErrorBoundary>
      <Sonner />
      <BrowserRouter>
        <TooltipProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </TooltipProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </QueryClientProvider>
);

export default App;


