import { Suspense, lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";
import MobileBottomNav from "@/components/MobileBottomNav";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { AdminRoute } from "@/components/AdminRoute";
import { useScrollToTop } from "@/hooks/use-scroll-to-top";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import PageTransition from "@/components/PageTransition";

// Eager load critical pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Lazy load non-critical pages
const NotFound = lazy(() => import("./pages/NotFound"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ListItem = lazy(() => import("./pages/ListItem"));
const ItemDetail = lazy(() => import("./pages/ItemDetail"));
const Search = lazy(() => import("./pages/Search"));
const Messages = lazy(() => import("./pages/Messages"));
const Profile = lazy(() => import("./pages/Profile"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const Verification = lazy(() => import("./pages/Verification"));
const AdminVerification = lazy(() => import("./pages/AdminVerification"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const MyListings = lazy(() => import("./pages/MyListings"));
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



function AppRoutes() {
  useScrollToTop();
  const location = useLocation();
  
  return (
    <div className="flex flex-col min-h-screen w-full">
      <OfflineIndicator />
      <PWAInstallPrompt />
      {/* Skip to main content for keyboard navigation */}
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>
      
      <Suspense fallback={<LoadingSpinner />}>
        <main id="main-content">
          <PageTransition key={location.pathname}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
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
              <Route path="/disputes" element={<ErrorBoundary><ProtectedRoute><Disputes /></ProtectedRoute></ErrorBoundary>} />
              <Route path="/pwa-settings" element={<ErrorBoundary><PWASettings /></ErrorBoundary>} />
              <Route path="/offline" element={<ErrorBoundary><Offline /></ErrorBoundary>} />
              <Route path="/terms" element={<ErrorBoundary><Terms /></ErrorBoundary>} />
              <Route path="/privacy" element={<ErrorBoundary><Privacy /></ErrorBoundary>} />
              <Route path="*" element={<ErrorBoundary><NotFound /></ErrorBoundary>} />
            </Routes>
          </PageTransition>
        </main>
      </Suspense>
      <MobileBottomNav />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
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
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

