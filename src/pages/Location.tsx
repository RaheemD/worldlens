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
  Navigation,
  Scissors
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FeatureCard } from "@/components/ui/feature-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGeolocation } from "@/hooks/useGeolocation";
import { toast } from "sonner";

const TOMTOM_API_KEY = "CSVnjjusSujTgcDTDvy4HHUs1hTSwkAR";

interface TomTomPOI {
  id: string;
  poi: {
    name: string;
    categories: string[];
    classifications: Array<{
      code: string;
      names: Array<{ name: string }>;
    }>;
  };
  dist: number;
  position: {
    lat: number;
    lon: number;
  };
}

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

  const getCategoryIcon = (categoryCode: string): React.ElementType => {
    switch (categoryCode) {
      // Food
      case "RESTAURANT": return Utensils;
      case "CAFE": return Utensils;
      case "BAR": return Utensils;
      case "PUB": return Utensils;


      // Services
      case "ATM": return Bank;
      case "BANK": return Bank;
      case "PHARMACY": return Pill;
      case "HOSPITAL": return Building2;
      case "POLICE_STATION": return Shield;
      case "POST_OFFICE": return Building2;
      case "PETROL_STATION": return Car;
      case "PARKING_GARAGE": return Car;
      case "PUBLIC_TRANSPORT_STOP": return Bus;
      case "RAILROAD_STATION": return Bus;
      case "TRAIN_STATION": return Bus;
      case "PLACE_OF_WORSHIP": return Landmark;
      case "BEAUTY_SALON": return Scissors;
      case "HAIRDRESSER": return Scissors;
      case "DRY_CLEANER": return Sparkles;

      // Attractions
      case "MUSEUM": return Building2;
      case "MONUMENT": return Landmark;
      case "ZOO": return Sparkles;
      case "AMUSEMENT_PARK": return Ticket;
      case "STADIUM": return Ticket;
      case "TOURIST_ATTRACTION": return Landmark;
      case "WILDLIFE_PARK": return Sparkles;
      case "NATURE_RESERVE": return Sparkles;

      // Free/Nature
      case "PARK": return Sparkles;
      case "BEACH": return Sparkles;

      default: return MapPin;
    }
  };

  const mapTomTomToPlace = (item: TomTomPOI): Place => {
    const classification = item.poi.classifications[0];
    const categoryCode = classification?.code || "UNKNOWN";
    const typeName = classification?.names[0]?.name || item.poi.categories[0] || "Place";

    return {
      name: item.poi.name,
      distance: formatDistance(item.dist),
      type: capitalizeFirst(typeName),
      lat: item.position.lat,
      lng: item.position.lon,
      icon: getCategoryIcon(categoryCode),
    };
  };

  const fetchCategory = async (lat: number, lng: number, categorySet: string, radius: number, signal: AbortSignal) => {
    const url = `https://api.tomtom.com/search/2/nearbySearch/.json?key=${TOMTOM_API_KEY}&lat=${lat}&lon=${lng}&radius=${radius}&limit=50&categorySet=${categorySet}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map(mapTomTomToPlace);
  };

  const fetchNearbyPlaces = useCallback(async (lat: number, lng: number, options?: { force?: boolean }) => {
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;
    setIsLoadingPlaces(true);
    const controller = new AbortController();
    if (activeRequestRef.current) activeRequestRef.current.abort();
    activeRequestRef.current = controller;

    // Cache key based on lat/lng
    const cacheKey = `${Math.round(lat * 1000) / 1000}:${Math.round(lng * 1000) / 1000}`;

    if (!options?.force) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.ts < 60_000) {
        setNearbyPlaces(cached.data);
        setLastUpdated(new Date());
        setHasFetched(true);
        setIsLoadingPlaces(false);
        fetchInProgress.current = false;
        return;
      }
    }

    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      // TomTom Category IDs
      const CATEGORIES = {
        attractions: "7376,7317,9927,7302,9902", // Tourist Attraction, Museum, Wildlife Parks (includes National Parks), Trails, Amusement Parks
        food: "7315,9376,9379,7311", // Restaurant, Cafe, Bar, Pub
        services: "7397,7326,7321,7322,7313,7311,9361067,9361027,9361010", // ATM, Pharmacy, Hospital, Police, Parking, Gas Station, Salon, Hairdresser, Dry Cleaner
        free: "9357,9362,7339,7373" // Beach, Parks, Places of Worship, Shopping Centers
      };

      // Batch 1: High Priority (Attractions & Transport)
      const [attractions, transport] = await Promise.all([
        fetchCategory(lat, lng, CATEGORIES.attractions, 5000, controller.signal),
        fetchCategory(lat, lng, "7380,7380004,7380005,9942,7324", 5000, controller.signal), // Transport: Railroad, Urban, Subway, Public Transport, Railway
      ]);

      // Small delay to prevent 429 (Too Many Requests)
      await new Promise(resolve => setTimeout(resolve, 300));

      // Batch 2: Secondary (Food, Services, Free)
      const [food, services, free] = await Promise.all([
        fetchCategory(lat, lng, CATEGORIES.food, 2000, controller.signal),
        fetchCategory(lat, lng, CATEGORIES.services, 2500, controller.signal),
        fetchCategory(lat, lng, CATEGORIES.free, 3000, controller.signal),
      ]);

      // Merge all services for processing (personal care is now inside services)
      const allServices = [...services, ...transport];

      // Debug: Log transport services only
      console.log("🚇 TRANSPORT DATA RETURNED:");
      console.table(transport.map(s => ({ name: s.name, type: s.type, distance: s.distance })));

      // Smart sorting for attractions - prioritize major tourist destinations
      const priorityKeywords = ['national park', 'wildlife', 'sanctuary', 'museum', 'monument', 'fort', 'palace', 'cathedral', 'basilica', 'garden', 'zoo', 'aquarium', 'sanjay gandhi'];
      const sortAttractions = (places: Place[]) => {
        return places.sort((a, b) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();
          const aPriority = priorityKeywords.some(keyword => aName.includes(keyword));
          const bPriority = priorityKeywords.some(keyword => bName.includes(keyword));

          // If one has priority and the other doesn't, prioritize it
          if (aPriority && !bPriority) return -1;
          if (!aPriority && bPriority) return 1;

          // Otherwise sort by distance
          return parseFloat(a.distance) - parseFloat(b.distance);
        });
      };

      // Filter out only cemeteries from free category
      const filteredFree = free.filter(place => {
        const name = place.name.toLowerCase();
        return !name.includes('cemetery') && !name.includes('graveyard');
      });

      // Categorize free places for diversity
      const worshipKeywords = ['temple', 'mandir', 'church', 'mosque', 'masjid', 'gurudwara', 'synagogue', 'shrine', 'cathedral', 'basilica'];
      const shoppingKeywords = ['shopping', 'mall', 'plaza', 'center', 'centre'];

      const placesOfWorship = filteredFree.filter(place =>
        worshipKeywords.some(keyword => place.name.toLowerCase().includes(keyword))
      ).sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance)).slice(0, 10); // Max 10 places of worship

      const shoppingMalls = filteredFree.filter(place =>
        shoppingKeywords.some(keyword => place.name.toLowerCase().includes(keyword)) &&
        !worshipKeywords.some(keyword => place.name.toLowerCase().includes(keyword))
      ).sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance)).slice(0, 5); // Max 5 shopping malls

      const otherFree = filteredFree.filter(place => {
        const name = place.name.toLowerCase();
        return !worshipKeywords.some(keyword => name.includes(keyword)) &&
          !shoppingKeywords.some(keyword => name.includes(keyword));
      }).sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

      // Combine for diversity: beaches/parks first, then shopping malls, then places of worship
      const mixedFree = [...otherFree, ...shoppingMalls, ...placesOfWorship].slice(0, 15);

      // Categorize services with specific limits
      const metroTrainKeywords = ['metro', 'subway', 'railway', 'train', 'railroad'];
      const busKeywords = ['bus stop', 'bus station'];
      const policeKeywords = ['police'];
      const salonKeywords = ['salon', 'hairdresser', 'barber'];

      // Prioritize metro/train stations
      const metroTrainStations = allServices.filter(place => {
        const name = place.name.toLowerCase();
        const type = place.type.toLowerCase();
        return metroTrainKeywords.some(keyword => name.includes(keyword) || type.includes(keyword));
      }).sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance)).slice(0, 6); // Max 6 metro/train

      // Limit bus stops
      const busStops = allServices.filter(place => {
        const name = place.name.toLowerCase();
        const type = place.type.toLowerCase();
        return busKeywords.some(keyword => name.includes(keyword) || type.includes(keyword)) &&
          !metroTrainKeywords.some(keyword => name.includes(keyword) || type.includes(keyword));
      }).sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance)).slice(0, 3); // Max 3 bus stops

      // Limit police stations
      const policeStations = allServices.filter(place => {
        const name = place.name.toLowerCase();
        const type = place.type.toLowerCase();
        return policeKeywords.some(keyword => name.includes(keyword) || type.includes(keyword));
      }).sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance)).slice(0, 1); // Max 1 police

      // Limit salons
      const salons = allServices.filter(place => {
        const name = place.name.toLowerCase();
        const type = place.type.toLowerCase();
        return salonKeywords.some(keyword => name.includes(keyword) || type.includes(keyword));
      }).sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance)).slice(0, 2); // Max 2 salons

      // Calculate how many slots are left for other services
      const usedSlots = metroTrainStations.length + busStops.length + policeStations.length + salons.length;
      const remainingSlots = Math.max(15 - usedSlots, 3); // At least 3 other services

      // Other essential services - flexible to fill remaining slots
      const otherServices = allServices.filter(place => {
        const name = place.name.toLowerCase();
        const type = place.type.toLowerCase();
        return !metroTrainKeywords.some(keyword => name.includes(keyword) || type.includes(keyword)) &&
          !busKeywords.some(keyword => name.includes(keyword) || type.includes(keyword)) &&
          !policeKeywords.some(keyword => name.includes(keyword) || type.includes(keyword)) &&
          !salonKeywords.some(keyword => name.includes(keyword) || type.includes(keyword));
      }).sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance)).slice(0, remainingSlots);

      // Combine: metro/train first, then bus, then other services, police, and salons
      const mixedServices = [...metroTrainStations, ...busStops, ...otherServices, ...policeStations, ...salons].slice(0, 15);

      const formatted = {
        attractions: sortAttractions(attractions).slice(0, 15),
        food: food.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance)).slice(0, 15),
        free: mixedFree,
        services: mixedServices,
      };

      setNearbyPlaces(formatted);
      cacheRef.current.set(cacheKey, { ts: Date.now(), data: formatted });
      setLastUpdated(new Date());
      setHasFetched(true);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error("TomTom fetch error:", err);
        if (!hasFetched) {
          toast.error("Nearby search is busy. Please try again.");
        }
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
    const refreshed = await refresh();
    const nextLat = refreshed?.latitude ?? latitude;
    const nextLng = refreshed?.longitude ?? longitude;

    if (nextLat && nextLng) {
      await fetchNearbyPlaces(nextLat, nextLng, { force: true });
    } else {
      toast.error("Location unavailable. Please enable location access.");
    }
  }, [refresh, latitude, longitude, fetchNearbyPlaces]);


  const formatLastUpdated = () => {
    if (!lastUpdated) return "";
    return lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    const lat = Number(place.lat);
    const lng = Number(place.lng);

    if (isNaN(lat) || isNaN(lng)) {
      console.error("Invalid coordinates for place:", place);
      return;
    }

    // Use 'dir' (Directions) ensuring destination is set correctly
    // This works better for 'Navigation' context than just 'search'
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    // Open in new tab/app
    const newWindow = window.open(url, '_blank');

    // Fallback if popup blocker interferes (though strictly onClick shouldn't trigger it)
    if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
      window.location.href = url;
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
