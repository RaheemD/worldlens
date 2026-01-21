import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { MapPin, Camera, Navigation, Coffee, Landmark, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AnimatedPage, fadeInUp, staggerContainer } from "@/components/AnimatedPage";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapView, MapMarker } from "@/components/map/MapView";
import { useGeolocation } from "@/hooks/useGeolocation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface NearbyPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  icon: string;
}

export default function Map() {
  const { latitude, longitude, isLoading: geoLoading, error: geoError, refresh } = useGeolocation();
  const { user } = useAuth();
  
  const [scanEntries, setScanEntries] = useState<any[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [isLoadingScans, setIsLoadingScans] = useState(false);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [filter, setFilter] = useState<"all" | "scans" | "pois">("all");
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);

  // Fetch user's scan entries with location
  useEffect(() => {
    async function fetchScans() {
      if (!user) return;
      
      setIsLoadingScans(true);
      try {
        const { data, error } = await supabase
          .from("scan_entries")
          .select("id, name, category, latitude, longitude, location_name, image_url")
          .eq("user_id", user.id)
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        setScanEntries(data || []);
      } catch (err) {
        console.error("Error fetching scans:", err);
      } finally {
        setIsLoadingScans(false);
      }
    }

    fetchScans();
  }, [user]);

  // Fetch nearby places when location is available
  useEffect(() => {
    async function fetchNearbyPlaces() {
      if (!latitude || !longitude) return;
      
      setIsLoadingPlaces(true);
      try {
        const radius = 1000; // 1km
        const query = `
          [out:json][timeout:10];
          (
            node["tourism"](around:${radius},${latitude},${longitude});
            node["amenity"~"restaurant|cafe|bar"](around:${radius},${latitude},${longitude});
            node["historic"](around:${radius},${latitude},${longitude});
          );
          out body 20;
        `;

        const response = await fetch(
          `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
        );

        if (!response.ok) throw new Error("Failed to fetch POIs");

        const data = await response.json();
        const places: NearbyPlace[] = data.elements
          .filter((el: any) => el.tags?.name)
          .map((el: any) => ({
            id: el.id.toString(),
            name: el.tags.name,
            lat: el.lat,
            lng: el.lon,
            type: el.tags.tourism || el.tags.amenity || el.tags.historic || "place",
            icon: getPlaceIcon(el.tags),
          }));

        setNearbyPlaces(places);
      } catch (err) {
        console.error("Error fetching nearby places:", err);
      } finally {
        setIsLoadingPlaces(false);
      }
    }

    fetchNearbyPlaces();
  }, [latitude, longitude]);

  function getPlaceIcon(tags: Record<string, string>): string {
    if (tags.tourism === "museum" || tags.historic) return "🏛️";
    if (tags.tourism === "attraction") return "⭐";
    if (tags.amenity === "restaurant") return "🍽️";
    if (tags.amenity === "cafe") return "☕";
    if (tags.amenity === "bar") return "🍸";
    return "📍";
  }

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

    // Add scan entries
    if (filter === "all" || filter === "scans") {
      scanEntries.forEach((scan) => {
        if (scan.latitude && scan.longitude) {
          result.push({
            id: scan.id,
            lat: parseFloat(scan.latitude),
            lng: parseFloat(scan.longitude),
            title: scan.name || scan.category,
            description: scan.location_name,
            type: "scan",
            icon: getCategoryIcon(scan.category),
          });
        }
      });
    }

    // Add nearby places
    if (filter === "all" || filter === "pois") {
      nearbyPlaces.forEach((place) => {
        result.push({
          id: place.id,
          lat: place.lat,
          lng: place.lng,
          title: place.name,
          description: place.type,
          type: "poi",
          icon: place.icon,
        });
      });
    }

    return result;
  }, [latitude, longitude, scanEntries, nearbyPlaces, filter]);

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

  const isLoading = geoLoading || isLoadingScans || isLoadingPlaces;

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
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList className="w-full bg-card/50">
                <TabsTrigger value="all" className="flex-1 text-xs">
                  All
                </TabsTrigger>
                <TabsTrigger value="scans" className="flex-1 text-xs">
                  <Camera className="h-3 w-3 mr-1" />
                  My Scans ({scanEntries.length})
                </TabsTrigger>
                <TabsTrigger value="pois" className="flex-1 text-xs">
                  <MapPin className="h-3 w-3 mr-1" />
                  Nearby ({nearbyPlaces.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </motion.div>

          {/* Map Container */}
          <motion.div 
            className="flex-1 px-4 pb-4 min-h-0"
            variants={fadeInUp}
          >
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
