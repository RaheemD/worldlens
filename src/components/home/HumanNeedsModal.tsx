import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Bath, 
  Droplets, 
  Landmark, 
  Pill, 
  Shield, 
  Building2, 
  Car, 
  LogOut,
  Loader2,
  Navigation,
  MapPin,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGeolocation } from "@/hooks/useGeolocation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type NeedType = "toilet" | "water" | "atm" | "pharmacy" | "police" | "hospital" | "taxi" | "exit";

interface NeedConfig {
  icon: React.ElementType;
  label: string;
  color: string;
  amenity: string;
  query: string;
}

const needsConfig: Record<NeedType, NeedConfig> = {
  toilet: { 
    icon: Bath, 
    label: "Toilet", 
    color: "text-info",
    amenity: "toilets",
    query: "amenity=toilets"
  },
  water: { 
    icon: Droplets, 
    label: "Water", 
    color: "text-info",
    amenity: "drinking_water",
    query: "amenity=drinking_water"
  },
  atm: { 
    icon: Landmark, 
    label: "ATM", 
    color: "text-success",
    amenity: "atm",
    query: "amenity=atm"
  },
  pharmacy: { 
    icon: Pill, 
    label: "Pharmacy", 
    color: "text-success",
    amenity: "pharmacy",
    query: "amenity=pharmacy"
  },
  police: { 
    icon: Shield, 
    label: "Police", 
    color: "text-warning",
    amenity: "police",
    query: "amenity=police"
  },
  hospital: { 
    icon: Building2, 
    label: "Hospital", 
    color: "text-danger",
    amenity: "hospital",
    query: "amenity=hospital"
  },
  taxi: { 
    icon: Car, 
    label: "Taxi", 
    color: "text-primary",
    amenity: "taxi",
    query: "amenity=taxi"
  },
  exit: { 
    icon: LogOut, 
    label: "Exit Route", 
    color: "text-primary",
    amenity: "public_transport",
    query: "public_transport=station"
  },
};

const needsList: NeedType[] = ["toilet", "water", "atm", "pharmacy", "police", "hospital", "taxi", "exit"];

interface NearbyResult {
  name: string;
  distance: number;
  lat: number;
  lng: number;
}

interface HumanNeedsModalProps {
  children: React.ReactNode;
}

export function HumanNeedsModal({ children }: HumanNeedsModalProps) {
  const { latitude, longitude, isLoading: locationLoading, error: locationError } = useGeolocation();
  const [open, setOpen] = useState(false);
  const [selectedNeed, setSelectedNeed] = useState<NeedType | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<NearbyResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedNeed(null);
      setResults([]);
      setSearchError(null);
    }
  }, [open]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const searchNearby = async (needType: NeedType) => {
    if (!latitude || !longitude) {
      toast.error("Location not available. Please enable GPS.");
      return;
    }

    setSelectedNeed(needType);
    setIsSearching(true);
    setSearchError(null);
    setResults([]);

    const config = needsConfig[needType];
    const radius = needType === "hospital" || needType === "police" ? 5000 : 2000;

    try {
      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["amenity"="${config.amenity}"](around:${radius},${latitude},${longitude});
          way["amenity"="${config.amenity}"](around:${radius},${latitude},${longitude});
        );
        out center body;
      `;

      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: `data=${encodeURIComponent(overpassQuery)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      if (!response.ok) throw new Error("Failed to search");

      const data = await response.json();
      
      const places: NearbyResult[] = data.elements
        .map((el: any) => {
          const lat = el.lat || el.center?.lat;
          const lng = el.lon || el.center?.lon;
          if (!lat || !lng) return null;
          
          const name = el.tags?.name || el.tags?.["name:en"] || config.label;
          const distance = calculateDistance(latitude, longitude, lat, lng);
          
          return { name, distance, lat, lng };
        })
        .filter(Boolean)
        .sort((a: NearbyResult, b: NearbyResult) => a.distance - b.distance)
        .slice(0, 5);

      setResults(places);
      
      if (places.length === 0) {
        setSearchError(`No ${config.label.toLowerCase()} found within ${radius / 1000}km`);
      }
    } catch (err) {
      console.error("Search error:", err);
      setSearchError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const openInMaps = (result: NearbyResult) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${result.lat},${result.lng}&travelmode=walking`;
    window.open(url, "_blank");
  };

  const openNearestInMaps = () => {
    if (results.length > 0) {
      openInMaps(results[0]);
    }
  };

  const handleGetMeOut = async () => {
    if (!latitude || !longitude) {
      toast.error("Location not available");
      return;
    }

    setSelectedNeed("exit");
    setIsSearching(true);
    setSearchError(null);
    setResults([]);

    try {
      // Search for transportation hubs, main roads, and well-lit public areas
      const overpassQuery = `
        [out:json][timeout:15];
        (
          node["public_transport"="station"](around:2000,${latitude},${longitude});
          node["railway"="station"](around:2000,${latitude},${longitude});
          node["amenity"="bus_station"](around:2000,${latitude},${longitude});
          node["highway"="bus_stop"](around:1000,${latitude},${longitude});
          node["amenity"="taxi"](around:1000,${latitude},${longitude});
        );
        out body;
      `;

      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: `data=${encodeURIComponent(overpassQuery)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      if (!response.ok) throw new Error("Search failed");

      const data = await response.json();

      const places: NearbyResult[] = data.elements
        .map((el: any) => {
          if (!el.lat || !el.lon) return null;
          const name = el.tags?.name || el.tags?.["name:en"] || "Transport Hub";
          const distance = calculateDistance(latitude, longitude, el.lat, el.lon);
          return { name, distance, lat: el.lat, lng: el.lon };
        })
        .filter(Boolean)
        .sort((a: NearbyResult, b: NearbyResult) => a.distance - b.distance)
        .slice(0, 5);

      setResults(places);

      if (places.length === 0) {
        // Fallback: open Google Maps with "transit stations near me"
        const fallbackUrl = `https://www.google.com/maps/search/transit+station/@${latitude},${longitude},15z`;
        window.open(fallbackUrl, "_blank");
        setSearchError("Opening Google Maps to find transit options...");
      }
    } catch (err) {
      console.error("Exit route error:", err);
      // Fallback to Google Maps
      const fallbackUrl = `https://www.google.com/maps/search/transit/@${latitude},${longitude},15z`;
      window.open(fallbackUrl, "_blank");
    } finally {
      setIsSearching(false);
    }
  };

  const handleNeedClick = (needType: NeedType) => {
    if (needType === "exit") {
      handleGetMeOut();
    } else {
      searchNearby(needType);
    }
  };

  const goBack = () => {
    setSelectedNeed(null);
    setResults([]);
    setSearchError(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="glass border-border/50 max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            {selectedNeed ? needsConfig[selectedNeed].label : "I Need Help"}
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {!selectedNeed ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Location status */}
              {locationLoading ? (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Getting your location...</span>
                </div>
              ) : locationError ? (
                <div className="flex items-center justify-center gap-2 text-sm text-destructive py-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>Location unavailable</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-1">
                  <MapPin className="h-3 w-3" />
                  <span>GPS Ready</span>
                </div>
              )}

              {/* Needs grid */}
              <div className="grid grid-cols-4 gap-3">
                {needsList.map((needType) => {
                  const config = needsConfig[needType];
                  return (
                    <motion.button
                      key={needType}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:bg-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handleNeedClick(needType)}
                      disabled={locationLoading || !!locationError}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <config.icon className={`h-6 w-6 ${config.color}`} />
                      <span className="text-xs font-medium text-foreground/70 hover:text-foreground">
                        {config.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* GET ME OUT button */}
              <Button 
                variant="destructive" 
                className="w-full mt-2 bg-danger hover:bg-danger/90"
                onClick={handleGetMeOut}
                disabled={locationLoading || !!locationError}
              >
                <LogOut className="h-4 w-4 mr-2" />
                GET ME OUT
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Searching nearby {needsConfig[selectedNeed].label.toLowerCase()}...
                  </p>
                </div>
              ) : searchError && results.length === 0 ? (
                <div className="text-center py-6">
                  <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">{searchError}</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={goBack}>
                    Try Another
                  </Button>
                </div>
              ) : (
                <>
                  {/* Results list */}
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {results.map((result, i) => (
                      <motion.button
                        key={i}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-all text-left"
                        onClick={() => openInMaps(result)}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{result.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistance(result.distance)} away
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-primary">
                          <Navigation className="h-4 w-4" />
                        </div>
                      </motion.button>
                    ))}
                  </div>

                  {/* Quick action: navigate to nearest */}
                  {results.length > 0 && (
                    <Button 
                      className="w-full" 
                      onClick={openNearestInMaps}
                    >
                      <Navigation className="h-4 w-4 mr-2" />
                      Navigate to Nearest ({formatDistance(results[0].distance)})
                    </Button>
                  )}

                  {/* Back button */}
                  <Button variant="ghost" className="w-full" onClick={goBack}>
                    ← Back to Help Options
                  </Button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
