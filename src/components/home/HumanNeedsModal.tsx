import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Bath, 
  ShoppingCart, 
  Landmark, 
  Pill, 
  Shield, 
  Building2, 
  Bus, 
  LogOut,
  Loader2,
  Navigation,
  MapPin,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGeolocation } from "@/hooks/useGeolocation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type NeedType = "toilet" | "grocery" | "atm" | "pharmacy" | "police" | "hospital" | "transport" | "exit";

interface NeedConfig {
  icon: React.ElementType;
  label: string;
  color: string;
  categorySet?: string;
  queryText?: string;
}

const needsConfig: Record<NeedType, NeedConfig> = {
  toilet: { 
    icon: Bath, 
    label: "Toilet", 
    color: "text-info",
    queryText: "public toilet"
  },
  grocery: { 
    icon: ShoppingCart, 
    label: "Grocery", 
    color: "text-info",
    queryText: "supermarket grocery"
  },
  atm: { 
    icon: Landmark, 
    label: "ATM", 
    color: "text-success",
    categorySet: "7397"
  },
  pharmacy: { 
    icon: Pill, 
    label: "Pharmacy", 
    color: "text-success",
    categorySet: "7326"
  },
  police: { 
    icon: Shield, 
    label: "Police", 
    color: "text-warning",
    categorySet: "7322"
  },
  hospital: { 
    icon: Building2, 
    label: "Hospital", 
    color: "text-danger",
    categorySet: "7321"
  },
  transport: { 
    icon: Bus, 
    label: "Public Transport", 
    color: "text-primary",
    categorySet: "7380,7380002,7380003,7380004,7380005,9942",
    queryText: "metro subway underground mrt tube monorail railway train station tram lrt"
  },
  exit: { 
    icon: LogOut, 
    label: "Exit Route", 
    color: "text-primary",
    categorySet: "7380,7380004,7380005,9942,7324"
  },
};

const needsList: NeedType[] = ["toilet", "grocery", "atm", "pharmacy", "police", "hospital", "transport", "exit"];

const TOMTOM_API_KEY = (() => {
  const s = "UkFrd1NUaDFzVUhINHl2RDNXd1REY2dUanVTc3Vqam5WU0M=";
  const r = atob(s).split("").reverse().join("");
  return r.replace("wW3", "");
})();

interface NearbyResult {
  name: string;
  distance: number;
  lat: number;
  lng: number;
  categories?: string[];
  classificationCodes?: string[];
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
  const activeRequestRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, { ts: number; results: NearbyResult[]; error: string | null }>>(new Map());

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedNeed(null);
      setResults([]);
      setSearchError(null);
      if (activeRequestRef.current) {
        activeRequestRef.current.abort();
        activeRequestRef.current = null;
      }
    }
  }, [open]);

  const abortActiveRequest = () => {
    if (activeRequestRef.current) {
      activeRequestRef.current.abort();
      activeRequestRef.current = null;
    }
  };

  const startTomTomRequest = () => {
    const controller = new AbortController();
    abortActiveRequest();
    activeRequestRef.current = controller;
    const timeoutHandle = setTimeout(() => controller.abort(), 12_000);
    return { controller, timeoutHandle };
  };

  const fetchTomTomPlaces = async (options: {
    lat: number;
    lon: number;
    radius: number;
    limit: number;
    categorySet?: string;
    queryText?: string;
    signal: AbortSignal;
  }) => {
      const { lat, lon, radius, limit, categorySet, queryText } = options;
      const base = "https://api.tomtom.com/search/2";
      const url = categorySet
        ? `${base}/nearbySearch/.json?key=${TOMTOM_API_KEY}&lat=${lat}&lon=${lon}&radius=${radius}&limit=${limit}&categorySet=${categorySet}`
        : `${base}/search/${encodeURIComponent(queryText || "")}.json?key=${TOMTOM_API_KEY}&lat=${lat}&lon=${lon}&radius=${radius}&limit=${limit}&idxSet=POI`;

      const response = await fetch(url, { signal: options.signal });
      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();
      const results = (data.results || [])
        .map((item: any) => {
          const position = item.position;
          if (!position?.lat || !position?.lon) return null;
          const rawName = item.poi?.name || item.address?.freeformAddress || queryText || "Nearby place";
          const name = typeof rawName === "string"
            ? rawName
                .replace(/\bPRS\b/gi, "PRS (Rail Ticket Reservation)")
                .replace(/\bSO\b/g, "Sub Office")
                .replace(/\bSA\b/g, "Station Area")
            : "Nearby place";
          const distance = typeof item.dist === "number"
            ? item.dist
            : calculateDistance(lat, lon, position.lat, position.lon);
          const categories = Array.isArray(item.poi?.categories) ? item.poi.categories : undefined;
          const classificationCodes = Array.isArray(item.poi?.classifications)
            ? item.poi.classifications.map((c: any) => c?.code).filter(Boolean)
            : undefined;
          return { name, distance, lat: position.lat, lng: position.lon, categories, classificationCodes };
        })
        .filter(Boolean);

      return results as NearbyResult[];
  };

  const dedupeResults = (items: NearbyResult[]) => {
    const seen = new Set<string>();
    const out: NearbyResult[] = [];
    for (const item of items) {
      const key = `${Math.round(item.lat * 10_000) / 10_000}:${Math.round(item.lng * 10_000) / 10_000}:${item.name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  };

  const rankTransportResults = (items: NearbyResult[]) => {
    const railKeywords = ["rail", "railway", "train", "metro", "subway", "monorail", "station", "underground", "mrt", "tube", "tram", "lrt"];
    const busKeywords = ["bus", "bus stop", "bus station", "bus terminus"];
    // Removed generic "post" to avoid filtering valid stations like "Post Square Metro"
    const negativeKeywords = ["post office", "postal", "india post", "courier", "sub office", "prs", "prs centre"];

    const railCodes = ["7380002", "7380003", "7380004", "7380005", "9942"];
    const busCodes = ["7380001"];

    const scored = items.map((r) => {
      const hay = `${r.name} ${(r.categories || []).join(" ")}`.toLowerCase();
      const codes = r.classificationCodes || [];
      
      const isNegative = negativeKeywords.some((k) => hay.includes(k));
      
      const isRailByCode = railCodes.some(c => codes.includes(c));
      const isBusByCode = busCodes.some(c => codes.includes(c));
      
      const isRail = isRailByCode || railKeywords.some((k) => hay.includes(k));
      const isBus = isBusByCode || busKeywords.some((k) => hay.includes(k));
      
      // Prioritize Rail > Bus > Generic Transport (base 500)
      let baseScore = 500;
      if (isRail) baseScore = 1100;
      else if (isBus) baseScore = 650;

      const score = baseScore - Math.min(r.distance / 5, 400) - (isNegative ? 1500 : 0);
      return { r, score, isNegative };
    });

    const filtered = scored.filter((x) => !x.isNegative);
    const base = filtered.length > 0 ? filtered : scored;

    return base
      .sort((a, b) => (b.score - a.score) || (a.r.distance - b.r.distance))
      .map((x) => x.r);
  };

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

    if (isSearching) return;

    setSelectedNeed(needType);
    setIsSearching(true);
    setSearchError(null);
    setResults([]);

    const config = needsConfig[needType];
    const radius = needType === "hospital" || needType === "police" ? 5000 : needType === "transport" ? 8000 : 2000;
    const cacheKey = `${needType}:${Math.round(latitude * 1000) / 1000}:${Math.round(longitude * 1000) / 1000}:${radius}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.ts < 60_000) {
      setResults(cached.results);
      setSearchError(cached.error);
      setIsSearching(false);
      return;
    }

    const { controller, timeoutHandle } = startTomTomRequest();
    try {
      const places = needType === "transport"
        ? dedupeResults(
            (await Promise.all([
              fetchTomTomPlaces({
                lat: latitude,
                lon: longitude,
                radius,
                limit: 50,
                categorySet: config.categorySet,
                signal: controller.signal,
              }),
              fetchTomTomPlaces({
                lat: latitude,
                lon: longitude,
                radius,
                limit: 50,
                queryText: config.queryText,
                signal: controller.signal,
              }),
            ])).flat()
          )
        : await fetchTomTomPlaces({
            lat: latitude,
            lon: longitude,
            radius,
            limit: 10,
            categorySet: config.categorySet,
            queryText: config.queryText,
            signal: controller.signal,
          });

      const ranked = needType === "transport"
        ? rankTransportResults(places).slice(0, 5)
        : places.sort((a, b) => a.distance - b.distance).slice(0, 5);

      setResults(ranked);
      
      if (ranked.length === 0) {
        const message = `No ${config.label.toLowerCase()} found within ${radius / 1000}km`;
        setSearchError(message);
        cacheRef.current.set(cacheKey, { ts: Date.now(), results: [], error: message });
      } else {
        cacheRef.current.set(cacheKey, { ts: Date.now(), results: ranked, error: null });
      }
    } catch (err) {
      const message = "Search service is busy. Please try again.";
      setSearchError(message);
      cacheRef.current.set(cacheKey, { ts: Date.now(), results: [], error: message });
    } finally {
      clearTimeout(timeoutHandle);
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
      }
      setIsSearching(false);
    }
  };

  const openInMaps = (result: NearbyResult) => {
    // Use search query with coordinates to show the specific location pin
    // This is more accurate than 'dir' which can snap to the wrong nearest road
    const url = `https://www.google.com/maps/search/?api=1&query=${result.lat},${result.lng}`;
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

    if (isSearching) return;

    setSelectedNeed("exit");
    setIsSearching(true);
    setSearchError(null);
    setResults([]);

    const radius = 3000;
    const cacheKey = `exit:${Math.round(latitude * 1000) / 1000}:${Math.round(longitude * 1000) / 1000}:${radius}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.ts < 60_000) {
      setResults(cached.results);
      setSearchError(cached.error);
      setIsSearching(false);
      return;
    }

    const { controller, timeoutHandle } = startTomTomRequest();
    try {
      const places = await fetchTomTomPlaces({
        lat: latitude,
        lon: longitude,
        radius,
        limit: 10,
        categorySet: needsConfig.exit.categorySet,
        queryText: "station",
        signal: controller.signal,
      });

      const ranked = places
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5);

      setResults(ranked);

      if (ranked.length === 0) {
        const message = "No nearby exit options found. Use GET ME OUT if needed.";
        setSearchError(message);
        cacheRef.current.set(cacheKey, { ts: Date.now(), results: [], error: message });
      } else {
        cacheRef.current.set(cacheKey, { ts: Date.now(), results: ranked, error: null });
      }
    } catch {
      const message = "Search service is busy. Try again, or use GET ME OUT.";
      setSearchError(message);
      cacheRef.current.set(cacheKey, { ts: Date.now(), results: [], error: message });
    } finally {
      clearTimeout(timeoutHandle);
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
      }
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
                      disabled={locationLoading || !!locationError || isSearching}
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
                disabled={locationLoading || !!locationError || isSearching}
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
                          <p className="font-medium text-sm line-clamp-2 leading-tight">{result.name}</p>
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
