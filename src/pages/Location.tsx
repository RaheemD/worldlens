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

interface Element {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
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

  const fetchNearbyPlaces = useCallback(async (lat: number, lng: number, options?: { force?: boolean }) => {
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;
    setIsLoadingPlaces(true);
    const controller = new AbortController();
    if (activeRequestRef.current) activeRequestRef.current.abort();
    activeRequestRef.current = controller;
    const radius = 1500;
    const cacheKey = `${Math.round(lat * 1000) / 1000}:${Math.round(lng * 1000) / 1000}:${radius}`;
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
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      // Production grade query with specific radii and strict categories
      const query = `
        [out:json][timeout:25];
        (
          // Food: 2000m - nwr for better coverage
          nwr["amenity"~"restaurant|cafe|fast_food|food_court|bar|pub|ice_cream|street_food"](around:2000,${lat},${lng});
          nwr["shop"~"bakery|pastry|confectionery|sweets|greengrocer"](around:2000,${lat},${lng});

          // Services: 1km - upgraded to nwr to catch ATMs/Banks mapped as ways/relations
          nwr["amenity"~"atm|pharmacy|hospital|police|taxi|fuel|parking|toilets|bus_station"](around:1000,${lat},${lng});
          nwr["highway"="bus_stop"](around:1000,${lat},${lng});
          nwr["public_transport"="station"](around:1000,${lat},${lng});
          nwr["railway"~"station|subway_entrance"](around:1000,${lat},${lng});

          // Attractions: 5km
          node["tourism"~"attraction|museum|gallery|viewpoint"](around:5000,${lat},${lng});
          node["leisure"="park"](around:5000,${lat},${lng});
          node["historic"="monument"](around:5000,${lat},${lng});
          node["amenity"~"place_of_worship|public_square"](around:5000,${lat},${lng});

          // Free-specific candidates: 3km (Expanded from 1km)
          node["leisure"~"park|beach|common"](around:3000,${lat},${lng});
          node["tourism"="viewpoint"](around:3000,${lat},${lng});
          node["amenity"="public_square"](around:3000,${lat},${lng});
        );
        out body center;
      `;
      let json: { elements?: Element[] } | null = null;
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
      
      // Use a Set to track processed IDs to avoid duplicates across categories
      const processedIds = new Set<number>();
      const processedFoodIds = new Set<string>();

      elements.forEach((element: Element) => {
        const tags = element.tags || {};
        const name = tags.name || tags["name:en"] || tags["brand"] || "Unknown";
        
        const elementLat = element.lat ?? element.center?.lat;
        const elementLon = element.lon ?? element.center?.lon;
        
        if (!elementLat || !elementLon) return;

        const distanceMeters = calculateDistance(lat, lng, elementLat, elementLon);
        
        const place: Place = {
          icon: Landmark,
          name,
          distance: formatDistance(distanceMeters),
          type: "",
          lat: elementLat,
          lng: elementLon,
        };

        // --- Food Categorization (2000m) ---
        if (distanceMeters <= 2000) {
          const foodKey = `${element.type}:${element.id}`;
          const isNamedFoodPlace = name !== "Unknown";
          if (tags.amenity && ["restaurant", "cafe", "fast_food", "food_court", "bar", "pub", "ice_cream", "street_food"].includes(tags.amenity)) {
            place.type = formatFoodType(tags);
            place.icon = Utensils;
            if (isNamedFoodPlace && !processedFoodIds.has(foodKey)) {
              processedFoodIds.add(foodKey);
              food.push(place);
            }
          } else if (tags.shop && ["bakery", "pastry", "confectionery", "sweets", "greengrocer"].includes(tags.shop)) {
            place.type = formatShopType(tags.shop);
            place.icon = Utensils;
            if (isNamedFoodPlace && !processedFoodIds.has(foodKey)) {
              processedFoodIds.add(foodKey);
              food.push(place);
            }
          }
        }

        // --- Services Categorization (1km) ---
        if (distanceMeters <= 1000) {
          if (tags.amenity && ["atm", "pharmacy", "hospital", "police", "taxi", "fuel", "parking", "toilets", "bus_station"].includes(tags.amenity)) {
            const info = getServiceInfo(tags.amenity);
            place.type = info.type;
            place.icon = info.icon;
            services.push(place);
          } else if (tags.highway === "bus_stop" || tags.public_transport === "station" || tags.railway === "station" || tags.railway === "subway_entrance") {
             const type = tags.railway === "subway_entrance" ? "Metro Entrance" : 
                          tags.railway === "station" ? "Metro Station" : 
                          tags.public_transport === "station" ? "Bus Station" : "Bus Stop";
             place.type = type;
             place.icon = Bus;
             services.push(place);
          }
        }

        // --- Attractions Categorization (5km) ---
        if (distanceMeters <= 5000) {
           if (tags.tourism && ["attraction", "museum", "gallery", "viewpoint"].includes(tags.tourism)) {
             place.type = formatTourismType(tags.tourism);
             place.icon = tags.tourism === "museum" ? Building2 : Landmark;
             attractions.push(place);
           } else if (tags.leisure === "park") {
             place.type = "Park";
             place.icon = Sparkles;
             attractions.push(place);
           } else if (tags.historic === "monument") {
             place.type = "Monument";
             place.icon = Landmark;
             attractions.push(place);
           } else if (tags.amenity === "place_of_worship") {
             // Distinguish temple, church, mosque if possible, else generic
             place.type = "Place of Worship"; 
             if (tags.religion) place.type = capitalizeFirst(tags.religion); // e.g. "Christian" -> Church? "Muslim" -> Mosque?
             // Simple mapping based on tags if available, or just generic
             place.icon = Landmark;
             attractions.push(place);
           }
        }

        // --- Free Categorization (3km) ---
        // Auto-assign if: category = park OR viewpoint OR beach OR public_square OR price info is missing or = 0
        if (distanceMeters <= 3000) {
          let isFreeCandidate = false;
          let freeType = "";
          let freeIcon = Sparkles;

          // 1. Check specific categories
          if (tags.leisure === "park") { isFreeCandidate = true; freeType = "Park"; }
          else if (tags.tourism === "viewpoint") { isFreeCandidate = true; freeType = "Viewpoint"; freeIcon = Landmark; }
          else if (tags.leisure === "beach" || tags.natural === "beach") { isFreeCandidate = true; freeType = "Beach"; }
          else if (tags.amenity === "public_square" || tags.place === "square") { isFreeCandidate = true; freeType = "Public Square"; freeIcon = Landmark; }
          
          // 2. Check generic "free" condition (missing fee or fee=no/0) for OTHER items found
          if (!isFreeCandidate) {
            // Check if it was already categorized as Attraction/Food/Service?
            // User's rule "Auto-assign if... OR price info is missing" is very broad.
            // Let's restrict it to "Attractions" that are free. We don't want "McDonalds" in Free just because it has no fee tag.
            // So, if it's an Attraction (museum, gallery, monument, place_of_worship) AND (fee is missing or no)
            const isAttractionType = (tags.tourism && ["attraction", "museum", "gallery", "viewpoint"].includes(tags.tourism)) ||
                                     (tags.historic === "monument") ||
                                     (tags.amenity === "place_of_worship");
            
            if (isAttractionType) {
               const fee = tags.fee || tags.charge;
               if (!fee || fee === "no" || fee === "0") {
                 isFreeCandidate = true;
                 // Reuse the type logic
                 if (tags.tourism) freeType = formatTourismType(tags.tourism);
                 else if (tags.historic) freeType = "Monument";
                 else if (tags.amenity === "place_of_worship") freeType = "Place of Worship";
                 freeIcon = Landmark;
               }
            }
          }

          if (isFreeCandidate) {
            // Create a copy for the Free list
            const freePlace = { ...place, type: freeType || place.type, icon: freeIcon };
            free.push(freePlace);
          }
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

  // Enhanced categorization helper functions
  const isFoodAmenity = (amenity: string): boolean => {
    return ["restaurant", "cafe", "fast_food", "bar", "pub", "food_court", "biergarten"].includes(amenity);
  };

  const isFoodShop = (shop: string): boolean => {
    return ["bakery", "butcher", "convenience", "supermarket", "greengrocer", "deli", "pastry", "cheese", "chocolate"].includes(shop);
  };

  const isServiceAmenity = (amenity: string): boolean => {
    return ["toilets", "atm", "pharmacy", "police", "hospital", "clinic", "doctors", "dentist", "veterinary", 
            "bank", "post_office", "library", "community_centre", "place_of_worship"].includes(amenity);
  };

  const isServiceShop = (shop: string): boolean => {
    return ["chemist", "optician", "hairdresser", "beauty", "laundry", "dry_cleaning", "tailor"].includes(shop);
  };

  const isServiceOffice = (office: string): boolean => {
    return ["government", "administrative", "diplomatic"].includes(office);
  };

  const formatLeisureType = (leisure: string): string => {
    const types: Record<string, string> = {
      "park": "Park",
      "garden": "Garden", 
      "playground": "Playground",
      "nature_reserve": "Nature Reserve",
      "recreation_ground": "Recreation Area",
      "common": "Common Land",
      "green": "Green Space",
      "beach": "Beach"
    };
    return types[leisure] || capitalizeFirst(leisure);
  };

  const formatHistoricType = (historic: string): string => {
    const types: Record<string, string> = {
      "monument": "Monument",
      "memorial": "Memorial",
      "castle": "Castle",
      "ruins": "Ruins"
    };
    return types[historic] || capitalizeFirst(historic);
  };

  const formatTourismType = (tourism: string): string => {
    const types: Record<string, string> = {
      "museum": "Museum",
      "gallery": "Art Gallery",
      "theme_park": "Theme Park",
      "zoo": "Zoo",
      "aquarium": "Aquarium",
      "planetarium": "Planetarium"
    };
    return types[tourism] || capitalizeFirst(tourism);
  };

  const formatFoodType = (tags: { cuisine?: string; amenity?: string }): string => {
    if (tags.cuisine) {
      const cuisines = tags.cuisine.split(";");
      const cuisineMap: Record<string, string> = {
        "italian": "Italian",
        "chinese": "Chinese",
        "indian": "Indian",
        "mexican": "Mexican",
        "japanese": "Japanese",
        "thai": "Thai",
        "french": "French",
        "mediterranean": "Mediterranean",
        "american": "American",
        "pizza": "Pizza"
      };
      return cuisineMap[cuisines[0]] || capitalizeFirst(cuisines[0]);
    }
    if (tags.amenity) {
      const amenityMap: Record<string, string> = {
        "restaurant": "Restaurant",
        "cafe": "Cafe",
        "fast_food": "Fast Food",
        "bar": "Bar",
        "pub": "Pub",
        "food_court": "Food Court",
        "biergarten": "Beer Garden"
      };
      return amenityMap[tags.amenity] || capitalizeFirst(tags.amenity);
    }
    return "Food";
  };

  const formatShopType = (shop: string): string => {
    const shopMap: Record<string, string> = {
      "bakery": "Bakery",
      "butcher": "Butcher",
      "convenience": "Convenience Store",
      "supermarket": "Supermarket",
      "greengrocer": "Greengrocer",
      "deli": "Deli",
      "pastry": "Pastry Shop",
      "cheese": "Cheese Shop",
      "chocolate": "Chocolate Shop"
    };
    return shopMap[shop] || capitalizeFirst(shop);
  };

  const formatOfficeType = (office: string): string => {
    const officeMap: Record<string, string> = {
      "government": "Government Office",
      "administrative": "Administrative Office",
      "diplomatic": "Embassy/Consulate"
    };
    return officeMap[office] || capitalizeFirst(office);
  };

  const getServiceInfo = (amenity: string): { icon: React.ElementType; type: string } => {
    const serviceMap: Record<string, { icon: React.ElementType; type: string }> = {
      toilets: { icon: Bath, type: "Toilet" },
      atm: { icon: Bank, type: "ATM" },
      pharmacy: { icon: Pill, type: "Pharmacy" },
      police: { icon: Shield, type: "Police" },
      hospital: { icon: Building2, type: "Hospital" },
      clinic: { icon: Building2, type: "Clinic" },
      doctors: { icon: Pill, type: "Doctor" },
      dentist: { icon: Pill, type: "Dentist" },
      veterinary: { icon: Pill, type: "Veterinary" },
      bank: { icon: Bank, type: "Bank" },
      post_office: { icon: Building2, type: "Post Office" },
      library: { icon: Building2, type: "Library" },
      community_centre: { icon: Building2, type: "Community Center" },
      place_of_worship: { icon: Building2, type: "Place of Worship" }
    };
    return serviceMap[amenity] || { icon: Building2, type: capitalizeFirst(amenity) };
  };

  const getServiceShopInfo = (shop: string): { icon: React.ElementType; type: string } => {
    const shopMap: Record<string, { icon: React.ElementType; type: string }> = {
      chemist: { icon: Pill, type: "Chemist" },
      optician: { icon: Pill, type: "Optician" },
      hairdresser: { icon: Sparkles, type: "Hairdresser" },
      beauty: { icon: Sparkles, type: "Beauty Salon" },
      laundry: { icon: Sparkles, type: "Laundry" },
      dry_cleaning: { icon: Sparkles, type: "Dry Cleaning" },
      tailor: { icon: Sparkles, type: "Tailor" }
    };
    return shopMap[shop] || { icon: Building2, type: capitalizeFirst(shop) };
  };

  const getTransportInfo = (tags: { railway?: string; public_transport?: string; highway?: string }): { icon: React.ElementType; type: string } | null => {
    if (tags.railway === "station" || tags.public_transport === "station") {
      return { icon: Bus, type: "Train Station" };
    } else if (tags.railway === "subway_entrance") {
      return { icon: Bus, type: "Subway Entrance" };
    } else if (tags.public_transport === "stop_position" || tags.highway === "bus_stop") {
      return { icon: Bus, type: "Bus Stop" };
    }
    return null;
  };

  const getEmergencyInfo = (emergency: string): { icon: React.ElementType; type: string } | null => {
    const emergencyMap: Record<string, { icon: React.ElementType; type: string }> = {
      fire_hydrant: { icon: Shield, type: "Fire Hydrant" },
      phone: { icon: Shield, type: "Emergency Phone" },
      assembly_point: { icon: Shield, type: "Assembly Point" }
    };
    return emergencyMap[emergency] || null;
  };

  const openInMaps = (place: Place) => {
    const lat = place.lat;
    const lng = place.lng;
    if (typeof lat !== "number" || typeof lng !== "number") return;
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
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
