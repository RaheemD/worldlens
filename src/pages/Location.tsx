import { useState, useEffect, useRef, useCallback } from "react";
import { 
  Landmark, 
  Utensils, 
  Sparkles, 
  Ticket, 
  Bath, 
  Landmark as Bank, 
  Pill, 
  Shield, 
  Building2, 
  Bus, 
  Car,
  Loader2,
  MapPin,
  AlertCircle,
  Navigation
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FeatureCard } from "@/components/ui/feature-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGeolocation } from "@/hooks/useGeolocation";
import { toast } from "sonner";

const overpassEndpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
];

interface Place {
  icon: React.ElementType;
  name: string;
  distance: string;
  type: string;
  lat?: number;
  lng?: number;
}

export default function Location() {
  const { latitude, longitude, locationName, error, isLoading, refresh } = useGeolocation();
  const [nearbyPlaces, setNearbyPlaces] = useState<{
    attractions: Place[];
    food: Place[];
    free: Place[];
    services: Place[];
  }>({
    attractions: [],
    food: [],
    free: [],
    services: [],
  });
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const hasFetchedInitial = useRef(false);
  const fetchInProgress = useRef(false);
  const activeRequestRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, { ts: number; data: { attractions: Place[]; food: Place[]; free: Place[]; services: Place[] } }>>(new Map());

  const fetchNearbyPlaces = useCallback(async (lat: number, lng: number) => {
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;
    setIsLoadingPlaces(true);
    const controller = new AbortController();
    if (activeRequestRef.current) activeRequestRef.current.abort();
    activeRequestRef.current = controller;
    const radius = 1500;
    const cacheKey = `${Math.round(lat * 1000) / 1000}:${Math.round(lng * 1000) / 1000}:${radius}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.ts < 60_000) {
      setNearbyPlaces(cached.data);
      setLastUpdated(new Date());
      setHasFetched(true);
      setIsLoadingPlaces(false);
      fetchInProgress.current = false;
      return;
    }
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const query = `
        [out:json][timeout:12];
        (
          node["tourism"~"museum|attraction|monument|artwork|viewpoint"](around:${radius},${lat},${lng});
          node["amenity"~"restaurant|cafe|fast_food|bar|pub"](around:${radius},${lat},${lng});
          node["leisure"~"park|garden|playground|nature_reserve"](around:${radius},${lat},${lng});
          node["shop"~"souvenir|convenience|supermarket"](around:${radius},${lat},${lng});
          node["amenity"~"toilets|atm|pharmacy|police|hospital|drinking_water"](around:${radius},${lat},${lng});
          node["public_transport"="station"](around:${radius},${lat},${lng});
        );
        out body;
      `;
      let json: any = null;
      for (const endpoint of overpassEndpoints) {
        const res = await fetch(endpoint, {
          method: "POST",
          body: `data=${encodeURIComponent(query)}`,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          signal: controller.signal,
          cache: "no-store",
        }).catch(() => null);
        if (res && res.ok) {
          json = await res.json();
          break;
        }
      }
      const attractions: Place[] = [];
      const food: Place[] = [];
      const free: Place[] = [];
      const services: Place[] = [];
      const elements = json?.elements || [];
      elements.forEach((element: any) => {
        const tags = element.tags || {};
        const name = tags.name || tags["name:en"] || "Unknown";
        const distance = calculateDistance(lat, lng, element.lat, element.lon);
        const place: Place = {
          icon: Landmark,
          name,
          distance: formatDistance(distance),
          type: "",
          lat: element.lat,
          lng: element.lon,
        };
        if (tags.tourism) {
          place.type = capitalizeFirst(tags.tourism);
          place.icon = Landmark;
          if (tags.tourism === "museum") place.icon = Building2;
          attractions.push(place);
        } else if (tags.amenity === "restaurant" || tags.amenity === "cafe" || tags.amenity === "fast_food" || tags.amenity === "bar" || tags.amenity === "pub") {
          place.type = tags.cuisine ? capitalizeFirst(tags.cuisine.split(";")[0]) : capitalizeFirst(tags.amenity);
          place.icon = Utensils;
          food.push(place);
        } else if (tags.leisure === "park" || tags.leisure === "garden" || tags.leisure === "playground" || tags.leisure === "nature_reserve") {
          place.type = capitalizeFirst(tags.leisure);
          place.icon = Sparkles;
          free.push(place);
        } else if (tags.shop === "souvenir" || tags.shop === "convenience" || tags.shop === "supermarket") {
          place.type = capitalizeFirst(tags.shop);
          place.icon = Ticket;
          free.push(place);
        } else if (tags.amenity) {
          const serviceMap: Record<string, { icon: React.ElementType; type: string }> = {
            toilets: { icon: Bath, type: "Toilet" },
            atm: { icon: Bank, type: "ATM" },
            pharmacy: { icon: Pill, type: "Pharmacy" },
            police: { icon: Shield, type: "Police" },
            hospital: { icon: Building2, type: "Hospital" },
            drinking_water: { icon: Sparkles, type: "Water" },
          };
          const service = serviceMap[tags.amenity];
          if (service) {
            place.icon = service.icon;
            place.type = service.type;
            services.push(place);
          }
        } else if (tags.public_transport === "station") {
          place.icon = Bus;
          place.type = "Station";
          services.push(place);
        }
      });
      const formatted = {
        attractions: attractions.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance)).slice(0, 10),
        food: food.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance)).slice(0, 10),
        free: free.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance)).slice(0, 10),
        services: services.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance)).slice(0, 10),
      };
      setNearbyPlaces(formatted);
      cacheRef.current.set(cacheKey, { ts: Date.now(), data: formatted });
      setLastUpdated(new Date());
      setHasFetched(true);
    } catch {
      if (!hasFetched) {
        toast.error("Nearby search is busy. Please try again.");
      }
    } finally {
      clearTimeout(timeout);
      setIsLoadingPlaces(false);
      fetchInProgress.current = false;
      if (activeRequestRef.current === controller) activeRequestRef.current = null;
    }
  }, [hasFetched]);

  // Only fetch once when location first becomes available
  useEffect(() => {
    if (latitude && longitude && !hasFetchedInitial.current) {
      hasFetchedInitial.current = true;
      fetchNearbyPlaces(latitude, longitude);
    }
  }, [latitude, longitude, fetchNearbyPlaces]);

  const handleRefresh = useCallback(async () => {
    // Only fetch places, don't refresh geolocation to avoid race conditions
    if (latitude && longitude) {
      await fetchNearbyPlaces(latitude, longitude);
    }
  }, [latitude, longitude, fetchNearbyPlaces]);


  const formatLastUpdated = () => {
    if (!lastUpdated) return "";
    return lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const capitalizeFirst = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, " ");
  };

  const openInMaps = (place: Place) => {
    if (place.lat && place.lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`, "_blank");
    }
  };

  return (
    <AppLayout title="Near Me">
      <div className="px-4 py-4 space-y-4">
        {/* Location Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${error ? "bg-destructive/10" : "bg-info/10"}`}>
              {isLoading ? (
                <Loader2 className="h-5 w-5 text-info animate-spin" />
              ) : error ? (
                <AlertCircle className="h-5 w-5 text-destructive" />
              ) : (
                <MapPin className="h-5 w-5 text-info" />
              )}
            </div>
            <div>
              <p className="font-semibold">
                {error ? "Location Error" : locationName || "Locating..."}
              </p>
              <p className="text-xs text-muted-foreground">
                {error ? error : latitude ? `${latitude.toFixed(4)}, ${longitude?.toFixed(4)}` : "Getting your location..."}
                {lastUpdated && !error && (
                  <span className="ml-2">• Updated {formatLastUpdated()}</span>
                )}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading || isLoadingPlaces}
          >
            {isLoading || isLoadingPlaces ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Refresh"
            )}
          </Button>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-center">
            <p className="text-sm text-destructive">
              Enable location access to see nearby places
            </p>
            <Button size="sm" variant="outline" className="mt-2" onClick={refresh}>
              Try Again
            </Button>
          </div>
        )}

        {/* Category Tabs */}
        <Tabs defaultValue="attractions" className="w-full">
          <TabsList className="w-full grid grid-cols-4 bg-card border border-border/50 h-12 p-1">
            <TabsTrigger value="attractions" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Attractions
            </TabsTrigger>
            <TabsTrigger value="food" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Food
            </TabsTrigger>
            <TabsTrigger value="free" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Free
            </TabsTrigger>
            <TabsTrigger value="services" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Services
            </TabsTrigger>
          </TabsList>

          {isLoadingPlaces ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          ) : (
            <>
              <TabsContent value="attractions" className="mt-4 space-y-3">
                {nearbyPlaces.attractions.length === 0 ? (
                  <EmptyState category="attractions" hasFetched={hasFetched} />
                ) : (
                  nearbyPlaces.attractions.map((place, i) => (
                    <FeatureCard
                      key={i}
                      icon={<place.icon className="h-5 w-5" />}
                      title={place.name}
                      subtitle={place.distance}
                      action={
                        <div className="flex items-center gap-2">
                          <StatusBadge variant="info">{place.type}</StatusBadge>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openInMaps(place)}>
                            <Navigation className="h-4 w-4" />
                          </Button>
                        </div>
                      }
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="food" className="mt-4 space-y-3">
                {nearbyPlaces.food.length === 0 ? (
                  <EmptyState category="food places" hasFetched={hasFetched} />
                ) : (
                  nearbyPlaces.food.map((place, i) => (
                    <FeatureCard
                      key={i}
                      icon={<place.icon className="h-5 w-5" />}
                      title={place.name}
                      subtitle={place.distance}
                      action={
                        <div className="flex items-center gap-2">
                          <StatusBadge variant="success">{place.type}</StatusBadge>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openInMaps(place)}>
                            <Navigation className="h-4 w-4" />
                          </Button>
                        </div>
                      }
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="free" className="mt-4 space-y-3">
                {nearbyPlaces.free.length === 0 ? (
                  <EmptyState category="free activities" hasFetched={hasFetched} />
                ) : (
                  nearbyPlaces.free.map((place, i) => (
                    <FeatureCard
                      key={i}
                      icon={<place.icon className="h-5 w-5" />}
                      title={place.name}
                      subtitle={place.distance}
                      action={
                        <div className="flex items-center gap-2">
                          <StatusBadge variant="primary">{place.type}</StatusBadge>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openInMaps(place)}>
                            <Navigation className="h-4 w-4" />
                          </Button>
                        </div>
                      }
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="services" className="mt-4 space-y-3">
                {nearbyPlaces.services.length === 0 ? (
                  <EmptyState category="services" hasFetched={hasFetched} />
                ) : (
                  nearbyPlaces.services.map((place, i) => (
                    <FeatureCard
                      key={i}
                      icon={<place.icon className="h-5 w-5" />}
                      title={place.name}
                      subtitle={place.distance}
                      action={
                        <div className="flex items-center gap-2">
                          <StatusBadge variant="default">{place.type}</StatusBadge>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openInMaps(place)}>
                            <Navigation className="h-4 w-4" />
                          </Button>
                        </div>
                      }
                    />
                  ))
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}

function EmptyState({ category, hasFetched }: { category: string; hasFetched: boolean }) {
  if (!hasFetched) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Loader2 className="h-12 w-12 mx-auto mb-3 opacity-30 animate-spin" />
        <p>Searching for {category}...</p>
      </div>
    );
  }
  
  return (
    <div className="text-center py-8 text-muted-foreground">
      <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
      <p>No {category} found nearby</p>
      <p className="text-xs mt-1">Try refreshing or moving to a different area</p>
    </div>
  );
}
