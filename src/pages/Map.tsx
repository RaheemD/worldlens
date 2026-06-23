import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { MapPin, Camera, Navigation, Loader2, AlertCircle, RefreshCw, HeartHandshake, Save } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AnimatedPage, fadeInUp, staggerContainer } from "@/components/AnimatedPage";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapView, MapMarker } from "@/components/map/MapView";
import { useGeolocation } from "@/hooks/useGeolocation";
import { toast } from "sonner";

interface NearbyPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  icon: string;
  distanceMeters?: number;
}

type MapMode = "tourist" | "essentials" | "pins";

const TOMTOM_API_KEY = (() => {
  const s = "UkFrd1NUaDFzVUhINHl2RDNXd1REY2dUanVTc3Vqam5WU0M=";
  const r = atob(s).split("").reverse().join("");
  return r.replace("wW3", "");
})();

interface TomTomSearchResult {
  id?: string;
  dist?: number;
  position?: { lat?: number; lon?: number };
  poi?: {
    name?: string;
    categories?: string[];
    classifications?: Array<{ code?: string }>;
  };
  address?: { freeformAddress?: string };
}

export default function ExploreMap() {
  const { latitude, longitude, isLoading: geoLoading, error: geoError, refresh } = useGeolocation();
  
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [mode, setMode] = useState<MapMode>("tourist");
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const activeRequestRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, { ts: number; places: NearbyPlace[] }>>(new Map());
  const [savedPlaces, setSavedPlaces] = useState<NearbyPlace[]>([]);

  useEffect(() => {
    setSelectedMarker(null);
  }, [mode]);

  const toNumber = useCallback((value: string | number | null | undefined) => {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem("ww_saved_places");
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as NearbyPlace[];
        if (Array.isArray(parsed)) setSavedPlaces(parsed);
      } catch (e) { void e }
    }
  }, []);

  const persistSaved = useCallback((items: NearbyPlace[]) => {
    setSavedPlaces(items);
    try {
      localStorage.setItem("ww_saved_places", JSON.stringify(items));
    } catch (e) { void e }
  }, []);

  const addSavedPlace = useCallback((place: NearbyPlace) => {
    const key = `${Math.round(place.lat * 10_000) / 10_000}:${Math.round(place.lng * 10_000) / 10_000}:${place.name.toLowerCase()}`;
    const exists = savedPlaces.some((p) => `${Math.round(p.lat * 10_000) / 10_000}:${Math.round(p.lng * 10_000) / 10_000}:${p.name.toLowerCase()}` === key);
    if (exists) {
      toast.info("Already saved");
      return;
    }
    const next = [{ ...place, id: place.id || key }, ...savedPlaces].slice(0, 200);
    persistSaved(next);
    toast.success("Saved");
  }, [savedPlaces, persistSaved]);

  const formatDistance = (meters: number | undefined) => {
    if (typeof meters !== "number" || Number.isNaN(meters)) return "";
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const openInMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(url, "_blank");
  };

  const getTomTomIcon = useCallback((classificationCode: string | undefined, categories: string[] | undefined) => {
    const code = (classificationCode || "").toUpperCase();
    const cats = (categories || []).join(" ").toLowerCase();

    if (code.includes("MUSEUM") || cats.includes("museum")) return "🏛️";
    if (code.includes("MONUMENT") || cats.includes("monument")) return "🏛️";
    if (code.includes("TOURIST_ATTRACTION") || cats.includes("tourist") || cats.includes("attraction")) return "⭐";
    if (code.includes("PARK") || cats.includes("park") || cats.includes("garden")) return "🌿";
    if (code.includes("BEACH") || cats.includes("beach")) return "🏖️";
    if (code.includes("RESTAURANT") || cats.includes("restaurant")) return "🍽️";
    if (code.includes("CAFE") || cats.includes("cafe") || cats.includes("coffee")) return "☕";
    if (code.includes("BAR") || code.includes("PUB") || cats.includes("bar") || cats.includes("pub")) return "🍺";
    if (code.includes("ATM") || cats.includes("atm")) return "🏧";
    if (code.includes("PHARMACY") || cats.includes("pharmacy") || cats.includes("chemist")) return "💊";
    if (code.includes("HOSPITAL") || cats.includes("hospital") || cats.includes("clinic")) return "🏥";
    if (code.includes("POLICE") || cats.includes("police")) return "👮";
    if (code.includes("TRAIN") || code.includes("RAIL") || code.includes("SUBWAY") || code.includes("METRO") || cats.includes("rail") || cats.includes("metro") || cats.includes("subway")) return "🚇";
    if (code.includes("BUS") || cats.includes("bus")) return "🚌";

    return "📍";
  }, []);

  const dedupePlaces = useCallback((items: NearbyPlace[]) => {
    const seen = new Set<string>();
    const out: NearbyPlace[] = [];
    for (const item of items) {
      const key = `${Math.round(item.lat * 10_000) / 10_000}:${Math.round(item.lng * 10_000) / 10_000}:${item.name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }, []);

  const fetchTomTomCategory = useCallback(async (lat: number, lon: number, categorySet: string, radius: number, limit: number, signal: AbortSignal) => {
    const url = `https://api.tomtom.com/search/2/nearbySearch/.json?key=${TOMTOM_API_KEY}&lat=${lat}&lon=${lon}&radius=${radius}&limit=${limit}&categorySet=${categorySet}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = await res.json();

    return (data.results || [])
      .map((item: TomTomSearchResult) => {
        const position = item.position;
        if (!position?.lat || !position?.lon) return null;
        const rawName = item.poi?.name || item.address?.freeformAddress || "Nearby place";
        const name = typeof rawName === "string" ? rawName : "Nearby place";
        const dist = typeof item.dist === "number" ? item.dist : undefined;
        const categories = Array.isArray(item.poi?.categories) ? item.poi.categories : undefined;
        const primaryCode = item.poi?.classifications?.[0]?.code as string | undefined;

        return {
          id: String(item.id || `${position.lat},${position.lon}-${name}`),
          name,
          lat: position.lat,
          lng: position.lon,
          type: item.poi?.categories?.[0] || "place",
          icon: getTomTomIcon(primaryCode, categories),
          distanceMeters: dist,
        } satisfies NearbyPlace;
      })
      .filter(Boolean) as NearbyPlace[];
  }, [getTomTomIcon]);

  const fetchNearbyPlaces = useCallback(async (lat: number, lon: number, nextMode: MapMode) => {
    if (activeRequestRef.current) {
      activeRequestRef.current.abort();
      activeRequestRef.current = null;
    }

    if (nextMode === "pins") {
      setNearbyPlaces([]);
      return;
    }

    const cacheKey = `${nextMode}:${Math.round(lat * 1000) / 1000}:${Math.round(lon * 1000) / 1000}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.ts < 60_000) {
      setNearbyPlaces(cached.places);
      return;
    }

    setIsLoadingPlaces(true);
    const controller = new AbortController();
    activeRequestRef.current = controller;
    const timeoutHandle = setTimeout(() => controller.abort(), 12_000);

    try {
      if (nextMode === "tourist") {
        const CATEGORIES = {
          attractions: "7376,7317,9927,7302,9902",
          food: "7315,9376,9379,7311",
          free: "9357,9362,7339,7373",
          transport: "7380,7380002,7380003,7380004,7380005,9942",
        };

        const [attractions, food, free, transport] = await Promise.all([
          fetchTomTomCategory(lat, lon, CATEGORIES.attractions, 5000, 30, controller.signal),
          fetchTomTomCategory(lat, lon, CATEGORIES.food, 2000, 30, controller.signal),
          fetchTomTomCategory(lat, lon, CATEGORIES.free, 3000, 25, controller.signal),
          fetchTomTomCategory(lat, lon, CATEGORIES.transport, 5000, 30, controller.signal),
        ]);

        const combined = dedupePlaces([...attractions, ...food, ...free, ...transport])
          .sort((a, b) => (a.distanceMeters ?? Number.MAX_SAFE_INTEGER) - (b.distanceMeters ?? Number.MAX_SAFE_INTEGER))
          .slice(0, 60);

        setNearbyPlaces(combined);
        cacheRef.current.set(cacheKey, { ts: Date.now(), places: combined });
        return;
      }

      const essentialsCategorySet = "7397,7326,7321,7322";
      const transportCategorySet = "7380,7380002,7380003,7380004,7380005,9942";

      const [essentials, transport] = await Promise.all([
        fetchTomTomCategory(lat, lon, essentialsCategorySet, 5000, 40, controller.signal),
        fetchTomTomCategory(lat, lon, transportCategorySet, 5000, 30, controller.signal),
      ]);

      const combined = dedupePlaces([...essentials, ...transport])
        .sort((a, b) => (a.distanceMeters ?? Number.MAX_SAFE_INTEGER) - (b.distanceMeters ?? Number.MAX_SAFE_INTEGER))
        .slice(0, 60);

      setNearbyPlaces(combined);
      cacheRef.current.set(cacheKey, { ts: Date.now(), places: combined });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setNearbyPlaces([]);
      }
    } finally {
      clearTimeout(timeoutHandle);
      if (activeRequestRef.current === controller) activeRequestRef.current = null;
      setIsLoadingPlaces(false);
    }
  }, [dedupePlaces, fetchTomTomCategory]);

  // Fetch nearby places when location is available
  useEffect(() => {
    if (!latitude || !longitude) return;
    fetchNearbyPlaces(latitude, longitude, mode);
  }, [latitude, longitude, mode, fetchNearbyPlaces]);

  // Convert data to map markers
  const markers = useMemo(() => {
    const result: MapMarker[] = [];

    // Add user location
    if (latitude && longitude) {
      result.push({
        id: "user-location",
        lat: latitude,
        lng: longitude,
        title: "You are here",
        type: "user",
        icon: "👤",
      });
    }

    if (mode === "pins") {
      savedPlaces.forEach((p) => {
        result.push({
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          title: p.name,
          description: p.type,
          type: "scan",
          icon: p.icon,
        });
      });
    }

    // Add nearby places
    if (mode !== "pins") {
      nearbyPlaces.forEach((place) => {
        const distanceText = formatDistance(place.distanceMeters);
        result.push({
          id: place.id,
          lat: place.lat,
          lng: place.lng,
          title: place.name,
          description: distanceText ? `${place.type} • ${distanceText}` : place.type,
          type: "poi",
          icon: place.icon,
        });
      });
    }

    return result;
  }, [latitude, longitude, savedPlaces, nearbyPlaces, mode]);

  function getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      food: "🍜",
      attraction: "🏛️",
      transport: "🚌",
      shopping: "🛍️",
      accommodation: "🏨",
      document: "📄",
    };
    return icons[category?.toLowerCase()] || "📷";
  }

  const center: [number, number] = latitude && longitude 
    ? [latitude, longitude] 
    : [35.6762, 139.6503]; // Default to Tokyo

  const isLoading = geoLoading || isLoadingPlaces;
  const hasLocation = !!latitude && !!longitude;
  const showPinsEmpty = mode === "pins" && savedPlaces.length === 0;
  const showNearbyEmpty = mode !== "pins" && (!hasLocation || nearbyPlaces.length === 0);
  const topNearby = mode === "pins"
    ? []
    : nearbyPlaces
        .filter((p) => typeof p.distanceMeters === "number")
        .sort((a, b) => (a.distanceMeters ?? Number.MAX_SAFE_INTEGER) - (b.distanceMeters ?? Number.MAX_SAFE_INTEGER))
        .slice(0, 6);

  return (
    <AppLayout title="Explore Map">
      <AnimatedPage>
        <motion.div 
          className="flex flex-col h-[calc(100vh-140px)]"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {/* Header Controls */}
          <motion.div 
            className="px-4 py-3 space-y-3 flex-shrink-0"
            variants={fadeInUp}
          >
            {/* Location Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Navigation className="h-4 w-4 text-primary" />
                {geoLoading ? (
                  <span className="text-muted-foreground">Finding location...</span>
                ) : geoError ? (
                  <span className="text-destructive">Location unavailable</span>
                ) : (
                  <span className="text-muted-foreground">
                    {latitude?.toFixed(4)}, {longitude?.toFixed(4)}
                  </span>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={refresh}
                disabled={geoLoading}
              >
                <RefreshCw className={`h-4 w-4 ${geoLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {/* Filter Tabs */}
            <Tabs value={mode} onValueChange={(v) => setMode(v as MapMode)}>
              <TabsList className="w-full bg-card/50">
                <TabsTrigger value="tourist" className="flex-1 text-xs">
                  Tourist
                </TabsTrigger>
                <TabsTrigger value="essentials" className="flex-1 text-xs">
                  <HeartHandshake className="h-3 w-3 mr-1" />
                  Essentials
                </TabsTrigger>
                <TabsTrigger value="pins" className="flex-1 text-xs">
                  <Camera className="h-3 w-3 mr-1" />
                  Saved ({savedPlaces.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="text-xs text-muted-foreground px-1">
              {mode === "tourist" && "Tourist shows attractions, food, and transit around you. Tap a pin to open it in Maps."}
              {mode === "essentials" && "Essentials shows pharmacy, ATM, hospitals, police, and transport nearby."}
              {mode === "pins" && "Saved shows places you bookmarked. Tap Save on any nearby item to add it here."}
            </div>
          </motion.div>

          {/* Map Container */}
          <motion.div 
            className="flex-1 px-4 pb-4 min-h-0"
            variants={fadeInUp}
          >
            {showPinsEmpty && (
              <div className="mb-3 p-3 rounded-xl bg-card/50 border border-border/50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-sm">
                  <Camera className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">
                    No saved places yet. Tap Save on any nearby item to bookmark it.
                  </span>
                </div>
              </div>
            )}

            {mode !== "pins" && hasLocation && topNearby.length > 0 && (
              <div className="mb-3 p-3 rounded-xl bg-card/50 border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Closest nearby</div>
                  <Button size="sm" variant="outline" onClick={refresh} disabled={geoLoading || isLoadingPlaces}>
                    Refresh
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {topNearby.map((p) => (
                    <div
                      key={p.id}
                      className="w-full flex items-center justify-between gap-3 p-2 rounded-lg bg-background/60 border border-border/50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg">{p.icon}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium line-clamp-2 leading-tight">{p.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {p.type}{p.distanceMeters ? ` • ${formatDistance(p.distanceMeters)} away` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => addSavedPlace(p)}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openInMaps(p.lat, p.lng)} className="h-8 w-8">
                          <Navigation className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showNearbyEmpty && (
              <div className="mb-3 p-3 rounded-xl bg-card/50 border border-border/50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">
                    {!hasLocation
                      ? "Enable location to see nearby places."
                      : "No nearby places found within 1 km."}
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={refresh}>
                  Refresh
                </Button>
              </div>
            )}

            {isLoading && !latitude ? (
              <div className="h-full flex items-center justify-center bg-card/50 rounded-xl border border-border/50">
                <div className="text-center space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                  <p className="text-sm text-muted-foreground">Loading map...</p>
                </div>
              </div>
            ) : geoError && !latitude ? (
              <div className="h-full flex items-center justify-center bg-card/50 rounded-xl border border-border/50">
                <div className="text-center space-y-3 px-8">
                  <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    Enable location access to see the map
                  </p>
                  <Button onClick={refresh} variant="outline" size="sm">
                    Try Again
                  </Button>
                </div>
              </div>
            ) : (
              <MapView
                center={center}
                zoom={15}
                markers={markers}
                onMarkerClick={setSelectedMarker}
                className="h-full border border-border/50"
              />
            )}
          </motion.div>

          {/* Selected Marker Details */}
          {selectedMarker && selectedMarker.type !== "user" && (
            <motion.div
              className="absolute bottom-24 left-4 right-4 bg-card border border-border/50 rounded-xl p-4 shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{selectedMarker.icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{selectedMarker.title}</h3>
                  {selectedMarker.description && (
                    <p className="text-sm text-muted-foreground truncate">
                      {selectedMarker.description}
                    </p>
                  )}
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => addSavedPlace({
                          id: selectedMarker.id,
                          name: selectedMarker.title,
                          lat: selectedMarker.lat,
                          lng: selectedMarker.lng,
                          type: selectedMarker.description || "place",
                          icon: selectedMarker.icon || "📍",
                        })}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => openInMaps(selectedMarker.lat, selectedMarker.lng)}
                      >
                        <Navigation className="h-4 w-4 mr-2" />
                        Open in Maps
                      </Button>
                    </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedMarker(null)}
                >
                  ✕
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatedPage>
    </AppLayout>
  );
}
