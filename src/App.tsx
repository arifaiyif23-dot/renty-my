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
import { useScrollToTop } from "@/hooks/use-scroll-to-top";
import { AIChatWidget } from "@/components/AIChatWidget";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ListItem from "./pages/ListItem";
import ItemDetail from "./pages/ItemDetail";
import Search from "./pages/Search";
import Messages from "./pages/Messages";
import Wallet from "./pages/Wallet";
import Profile from "./pages/Profile";
import Wishlist from "./pages/Wishlist";
import Verification from "./pages/Verification";
import AdminVerification from "./pages/AdminVerification";
import AdminPayments from "./pages/AdminPayments";
import MyListings from "./pages/MyListings";

const queryClient = new QueryClient();

function AppRoutes() {
  useScrollToTop();
  
  return (
    <div className="flex flex-col min-h-screen w-full">
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/list-item" element={<ProtectedRoute><ListItem /></ProtectedRoute>} />
        <Route path="/items/:id" element={<ItemDetail />} />
        <Route path="/search" element={<Search />} />
        <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} />
        <Route path="/my-listings" element={<ProtectedRoute><MyListings /></ProtectedRoute>} />
        <Route path="/verification" element={<ProtectedRoute><Verification /></ProtectedRoute>} />
        <Route path="/admin/verifications" element={<ProtectedRoute><AdminVerification /></ProtectedRoute>} />
        <Route path="/admin/payments" element={<ProtectedRoute><AdminPayments /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
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
              <AIChatWidget />
            </AuthProvider>
          </TooltipProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

