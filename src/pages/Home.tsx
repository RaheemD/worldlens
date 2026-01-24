import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Camera, MapPin, AlertTriangle, HelpCircle, Loader2, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AnimatedPage, fadeInUp, staggerContainer } from "@/components/AnimatedPage";
import { ActionButton } from "@/components/ui/action-button";
import { FeatureCard } from "@/components/ui/feature-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { HumanNeedsModal } from "@/components/home/HumanNeedsModal";
import { Button } from "@/components/ui/button";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ScanEntry {
  id: string;
  name: string | null;
  category: string;
  image_url: string | null;
  created_at: string;
}

export default function Home() {
  const navigate = useNavigate();
  const { locationName, isLoading: locationLoading, error: locationError, refresh } = useGeolocation({
    autoRequest: "once-per-session",
    watch: false,
  });
  const { user } = useAuth();
  const [recentScans, setRecentScans] = useState<ScanEntry[]>([]);
  const [scansLoading, setScansLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchRecentScans();
    } else {
      setRecentScans([]);
    }
  }, [user]);

  const fetchRecentScans = async () => {
    setScansLoading(true);
    try {
      const { data, error } = await supabase
        .from("scan_entries")
        .select("id, name, category, image_url, created_at")
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      setRecentScans(data || []);
    } catch (err) {
      console.error("Error fetching recent scans:", err);
    } finally {
      setScansLoading(false);
    }
  };

  return (
    <AppLayout>
      <AnimatedPage>
        {/* Hero Glow Effect */}
        <div className="absolute inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_at_top,_hsl(175_80%_15%_/_0.3)_0%,_transparent_60%)] pointer-events-none" />
        
        <motion.div 
          className="relative px-4 py-6 space-y-6"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {/* Tagline */}
          <motion.div className="text-center py-4" variants={fadeInUp}>
            <h1 className="text-2xl font-bold tracking-tight">
              The World, <span className="text-gradient">Explained</span>
            </h1>
            <p className="text-muted-foreground mt-1">
              Point. Understand. Explore.
            </p>
          </motion.div>

          {/* Main Action Buttons */}
          <motion.div className="space-y-4" variants={fadeInUp}>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <ActionButton
                variant="scan"
                icon={<Camera className="h-10 w-10" />}
                subtitle="Monuments • Menus • Signs • Tickets"
                onClick={() => navigate("/scan")}
              >
                SCAN WORLD
              </ActionButton>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <ActionButton
                variant="location"
                icon={<MapPin className="h-10 w-10" />}
                subtitle="Nearby places • Services • Activities"
                onClick={() => navigate("/location")}
              >
                WHAT CAN I DO HERE
              </ActionButton>
            </motion.div>
          </motion.div>

          {/* Quick Stats */}
          <motion.div className="flex gap-2 justify-center items-center" variants={fadeInUp}>
            <StatusBadge variant="success" icon={<span className="w-1.5 h-1.5 rounded-full bg-success" />}>
              Safe Area
            </StatusBadge>
            <div className="flex items-center gap-1">
              <StatusBadge variant="info" icon={locationLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="w-1.5 h-1.5 rounded-full bg-info" />}>
                {locationLoading ? "Locating..." : locationError ? "Location unavailable" : locationName || "Unknown"}
              </StatusBadge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full"
                onClick={refresh}
                disabled={locationLoading}
                aria-label="Refresh location"
                title="Refresh location"
              >
                {locationLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </motion.div>

          {/* Safety Alert (if any) */}
          <motion.div variants={fadeInUp} whileHover={{ scale: 1.01 }}>
            <FeatureCard
              variant="warning"
              icon={<AlertTriangle className="h-5 w-5 text-warning" />}
              title="Tourist Alert Active"
              subtitle="Check safety info for your area"
              onClick={() => navigate("/safety")}
            />
          </motion.div>

          {/* Human Needs Button */}
          <motion.div variants={fadeInUp}>
            <HumanNeedsModal>
              <Button 
                variant="outline" 
                className="w-full h-14 rounded-xl border-border/50 bg-card hover:bg-card/80"
              >
                <HelpCircle className="h-5 w-5 mr-2 text-primary" />
                <span className="font-semibold text-foreground">I NEED HELP</span>
              </Button>
            </HumanNeedsModal>
          </motion.div>

          {/* Recent Scans Preview */}
          <motion.div className="space-y-3" variants={fadeInUp}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Recent Scans</h2>
              <Button variant="ghost" size="sm" className="text-primary" onClick={() => navigate("/journal")}>
                View All
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {scansLoading ? (
                // Loading placeholders
                [1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-xl bg-card border border-border/50 flex items-center justify-center"
                  >
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ))
              ) : recentScans.length > 0 ? (
                // Actual scans
                recentScans.map((scan) => (
                  <motion.div
                    key={scan.id}
                    className="aspect-square rounded-xl bg-card border border-border/50 overflow-hidden cursor-pointer"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate("/journal")}
                  >
                    {scan.image_url ? (
                      <img 
                        src={scan.image_url} 
                        alt={scan.name || "Scan"} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-2">
                        <Camera className="h-6 w-6 text-muted-foreground mb-1" />
                        <span className="text-xs text-muted-foreground text-center line-clamp-2">
                          {scan.name || scan.category}
                        </span>
                      </div>
                    )}
                  </motion.div>
                ))
              ) : (
                // Empty placeholders - show when not logged in or no scans
                [1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="aspect-square rounded-xl bg-card border border-border/50 flex items-center justify-center text-muted-foreground cursor-pointer"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate("/scan")}
                  >
                    <Camera className="h-8 w-8 opacity-30" />
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      </AnimatedPage>
    </AppLayout>
  );
}
