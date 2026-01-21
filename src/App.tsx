import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { AIUsageProvider } from "@/contexts/AIUsageContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Home from "./pages/Home";

import Scan from "./pages/Scan";
import Location from "./pages/Location";
import Safety from "./pages/Safety";
import Translate from "./pages/Translate";
import Spending from "./pages/Spending";
import Journal from "./pages/Journal";
import Settings from "./pages/Settings";
import Map from "./pages/Map";
import PlanTrip from "./pages/PlanTrip";
import SharedTrip from "./pages/SharedTrip";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Legacy route kept to avoid 404s; auth is handled via the header dialog. */}
        <Route path="/auth" element={<Navigate to="/?auth=1" replace />} />
        <Route path="/" element={<Home />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/location" element={<Location />} />
        <Route path="/safety" element={<Safety />} />
        <Route path="/translate" element={<Translate />} />
        <Route path="/spending" element={<Spending />} />
        <Route path="/map" element={<Map />} />
        <Route path="/plan" element={<PlanTrip />} />
        <Route path="/journal" element={<ProtectedRoute><Journal /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/trip/:shareCode" element={<SharedTrip />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <ProfileProvider>
          <AIUsageProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AnimatedRoutes />
              </BrowserRouter>
            </TooltipProvider>
          </AIUsageProvider>
        </ProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
