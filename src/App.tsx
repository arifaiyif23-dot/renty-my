import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

// Configure React Query with aggressive caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (replaces cacheTime)
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

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
              <Route path="/install" element={<Install />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/list-item" element={<ProtectedRoute><ListItem /></ProtectedRoute>} />
              <Route path="/items/:id" element={<ItemDetail />} />
              <Route path="/search" element={<Search />} />
              <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} />
              <Route path="/my-listings" element={<ProtectedRoute><MyListings /></ProtectedRoute>} />
              <Route path="/verification" element={<ProtectedRoute><Verification /></ProtectedRoute>} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="/earnings" element={<ProtectedRoute><Earnings /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminDashboard /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/payouts" element={<ProtectedRoute><AdminRoute><AdminPayouts /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/verifications" element={<ProtectedRoute><AdminRoute><AdminVerification /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute><AdminRoute><AdminSettings /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/automation" element={<ProtectedRoute><AdminRoute><AdminAutomation /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/health" element={<ProtectedRoute><AdminRoute><AdminHealth /></AdminRoute></ProtectedRoute>} />
              <Route path="/pwa-settings" element={<PWASettings />} />
              <Route path="/offline" element={<Offline />} />
              <Route path="*" element={<NotFound />} />
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
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
      <ErrorBoundary>
        <Toaster />
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

