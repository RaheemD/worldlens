import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Shield, CheckCircle, Clock, Loader2, Phone, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AnimatedPage, fadeInUp, staggerContainer } from "@/components/AnimatedPage";
import { FeatureCard } from "@/components/ui/feature-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { useGeolocation } from "@/hooks/useGeolocation";
import { supabase } from "@/integrations/supabase/client";

interface SafetyAlert {
  type: string;
  title: string;
  description: string;
  severity: string;
}

interface EmergencyNumbers {
  police: string;
  ambulance: string;
  fire: string;
  tourist_hotline?: string;
}

interface SafetyData {
  safetyLevel: "safe" | "caution" | "warning";
  alerts: SafetyAlert[];
  tips: string[];
  emergencyNumbers: EmergencyNumbers;
  customsInfo?: string;
}

export default function Safety() {
  const { latitude, longitude, locationName, countryCode, countryName, isLoading: locationLoading } = useGeolocation();
  const [safetyData, setSafetyData] = useState<SafetyData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedInitial = useRef(false);

  const fetchSafetyInfo = useCallback(async () => {
    if (!latitude || !longitude || !countryCode) {
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("get-safety-info", {
        body: { 
          locationName, 
          countryCode, 
          latitude, 
          longitude 
        },
      });

      if (fnError) throw fnError;
      setSafetyData(data);
    } catch (err) {
      console.error("Safety info error:", err);
      setError("Could not load safety information");
      // Set default data
      setSafetyData({
        safetyLevel: "safe",
        alerts: [],
        tips: [
          "Stay aware of your surroundings",
          "Keep valuables secure",
          "Have emergency contacts saved",
        ],
        emergencyNumbers: { police: "911", ambulance: "911", fire: "911" },
      });
    } finally {
      setIsLoading(false);
    }
  }, [latitude, longitude, locationName, countryCode]);

  // Only fetch once when location becomes available for the first time
  useEffect(() => {
    if (latitude && longitude && countryCode && !hasFetchedInitial.current) {
      hasFetchedInitial.current = true;
      fetchSafetyInfo();
    }
  }, [latitude, longitude, countryCode, fetchSafetyInfo]);

  const getSafetyLevelDisplay = (level: string) => {
    switch (level) {
      case "warning":
        return { variant: "warning" as const, text: "Use Caution", icon: AlertTriangle };
      case "caution":
        return { variant: "warning" as const, text: "Be Alert", icon: AlertTriangle };
      default:
        return { variant: "success" as const, text: "Generally Safe", icon: CheckCircle };
    }
  };

  const safetyLevel = safetyData ? getSafetyLevelDisplay(safetyData.safetyLevel) : null;

  return (
    <AppLayout title="Tourist Shield">
      <AnimatedPage>
        <motion.div 
          className="px-4 py-4 space-y-6"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {/* Status Header */}
          <motion.div 
            className="flex items-center justify-between p-4 bg-card rounded-2xl border border-border/50"
            variants={fadeInUp}
          >
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                safetyLevel?.variant === "success" ? "bg-success/10" : "bg-warning/10"
              }`}>
                <Shield className={`h-6 w-6 ${
                  safetyLevel?.variant === "success" ? "text-success" : "text-warning"
                }`} />
              </div>
              <div>
                <p className="font-semibold">Area Status</p>
                <p className="text-sm text-muted-foreground">
                  {locationLoading ? "Locating..." : locationName || "Unknown location"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchSafetyInfo}
                disabled={isLoading || !latitude || !longitude}
                className="h-9 w-9"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              {safetyLevel && !isLoading && (
                <StatusBadge variant={safetyLevel.variant} icon={<safetyLevel.icon className="h-3 w-3" />}>
                  {safetyLevel.text}
                </StatusBadge>
              )}
            </div>
          </motion.div>

          {isLoading ? (
            <motion.div 
              className="flex flex-col items-center justify-center py-12 gap-4"
              variants={fadeInUp}
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading safety information...</p>
            </motion.div>
          ) : safetyData ? (
            <>
              {/* Active Alerts */}
              {safetyData.alerts.length > 0 && (
                <motion.div className="space-y-3" variants={fadeInUp}>
                  <h2 className="font-semibold text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    Active Alerts
                  </h2>
                  {safetyData.alerts.map((alert, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <FeatureCard
                        variant={alert.severity === "high" ? "danger" : "warning"}
                        icon={
                          <AlertTriangle
                            className={`h-5 w-5 ${
                              alert.severity === "high" ? "text-danger" : "text-warning"
                            }`}
                          />
                        }
                        title={alert.title}
                        subtitle={alert.description}
                        action={
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {alert.type}
                          </div>
                        }
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* Safety Tips */}
              <motion.div className="space-y-3" variants={fadeInUp}>
                <h2 className="font-semibold text-lg">Safety Tips for This Area</h2>
                <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3">
                  {safetyData.tips.map((tip, i) => (
                    <motion.div 
                      key={i} 
                      className="flex items-start gap-3"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <CheckCircle className="h-4 w-4 text-success shrink-0 mt-0.5" />
                      <p className="text-sm text-foreground">{tip}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Customs Info */}
              {safetyData.customsInfo && (
                <motion.div className="space-y-3" variants={fadeInUp}>
                  <h2 className="font-semibold text-lg">Cultural Notes</h2>
                  <div className="bg-card rounded-2xl border border-border/50 p-4">
                    <p className="text-sm text-foreground">{safetyData.customsInfo}</p>
                  </div>
                </motion.div>
              )}

              {/* Emergency Numbers */}
              <motion.div className="space-y-3" variants={fadeInUp}>
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <Phone className="h-5 w-5 text-danger" />
                  Emergency Numbers
                  {countryName && <span className="text-sm font-normal text-muted-foreground">({countryName})</span>}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <motion.div 
                    className="bg-card rounded-xl border border-border/50 p-4"
                    whileHover={{ scale: 1.02 }}
                  >
                    <p className="text-xs text-muted-foreground">Police</p>
                    <p className="font-bold text-xl text-danger">{safetyData.emergencyNumbers.police}</p>
                  </motion.div>
                  <motion.div 
                    className="bg-card rounded-xl border border-border/50 p-4"
                    whileHover={{ scale: 1.02 }}
                  >
                    <p className="text-xs text-muted-foreground">Ambulance</p>
                    <p className="font-bold text-xl text-danger">{safetyData.emergencyNumbers.ambulance}</p>
                  </motion.div>
                  {safetyData.emergencyNumbers.fire && (
                    <motion.div 
                      className="bg-card rounded-xl border border-border/50 p-4"
                      whileHover={{ scale: 1.02 }}
                    >
                      <p className="text-xs text-muted-foreground">Fire</p>
                      <p className="font-bold text-xl text-danger">{safetyData.emergencyNumbers.fire}</p>
                    </motion.div>
                  )}
                  {safetyData.emergencyNumbers.tourist_hotline && (
                    <motion.div 
                      className="bg-card rounded-xl border border-border/50 p-4"
                      whileHover={{ scale: 1.02 }}
                    >
                      <p className="text-xs text-muted-foreground">Tourist Hotline</p>
                      <p className="font-bold text-xl text-info">{safetyData.emergencyNumbers.tourist_hotline}</p>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </>
          ) : error ? (
            <motion.div 
              className="text-center py-8 text-muted-foreground"
              variants={fadeInUp}
            >
              {error}
            </motion.div>
          ) : null}
        </motion.div>
      </AnimatedPage>
    </AppLayout>
  );
}
