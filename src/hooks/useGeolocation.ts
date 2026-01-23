import { useState, useEffect, useCallback } from "react";

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  isLoading: boolean;
  locationName: string | null;
  countryCode: string | null;
  countryName: string | null;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    isLoading: true,
    locationName: null,
    countryCode: null,
    countryName: null,
  });

  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
  } = options;

  const saveLastKnown = (lat: number, lng: number, locationName: string | null, countryCode: string | null, countryName: string | null) => {
    try {
      const payload = { lat, lng, locationName, countryCode, countryName, ts: Date.now() };
      localStorage.setItem("worldlens_last_location", JSON.stringify(payload));
    } catch {}
  };

  const loadLastKnown = (): { lat: number; lng: number; locationName: string | null; countryCode: string | null; countryName: string | null } | null => {
    try {
      const raw = localStorage.getItem("worldlens_last_location");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.lat === "number" && typeof parsed?.lng === "number") {
        return {
          lat: parsed.lat,
          lng: parsed.lng,
          locationName: parsed.locationName || null,
          countryCode: parsed.countryCode || null,
          countryName: parsed.countryName || null,
        };
      }
    } catch {}
    return null;
  };

  const getLocationInfo = async (lat: number, lng: number): Promise<{
    locationName: string | null;
    countryCode: string | null;
    countryName: string | null;
  }> => {
    try {
      // Use Nominatim for reverse geocoding (free, no API key needed)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
        {
          headers: {
            "User-Agent": "WorldLens Travel App",
          },
        }
      );
      
      if (!response.ok) return { locationName: null, countryCode: null, countryName: null };
      
      const data = await response.json();
      
      // Build a friendly location name
      const address = data.address;
      let locationName: string | null = null;
      let countryCode: string | null = null;
      let countryName: string | null = null;
      
      if (address) {
        const parts = [];
        if (address.neighbourhood) parts.push(address.neighbourhood);
        else if (address.suburb) parts.push(address.suburb);
        else if (address.town) parts.push(address.town);
        else if (address.city) parts.push(address.city);
        
        if (address.country) parts.push(address.country);
        
        locationName = parts.join(", ") || data.display_name?.split(",").slice(0, 2).join(",") || null;
        countryCode = address.country_code?.toUpperCase() || null;
        countryName = address.country || null;
      }
      
      return { locationName, countryCode, countryName };
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      return { locationName: null, countryCode: null, countryName: null };
    }
  };

  const ipFallback = async () => {
    try {
      const res = await fetch("https://ipapi.co/json/");
      if (!res.ok) throw new Error("IP geolocation failed");
      const data = await res.json();
      const lat = data.latitude;
      const lng = data.longitude;
      if (typeof lat !== "number" || typeof lng !== "number") throw new Error("No coordinates");
      const { locationName, countryCode, countryName } = await getLocationInfo(lat, lng);
      setState({
        latitude: lat,
        longitude: lng,
        accuracy: null,
        error: null,
        isLoading: false,
        locationName,
        countryCode,
        countryName,
      });
      saveLastKnown(lat, lng, locationName, countryCode, countryName);
    } catch {
      const last = loadLastKnown();
      if (last) {
        setState({
          latitude: last.lat,
          longitude: last.lng,
          accuracy: null,
          error: null,
          isLoading: false,
          locationName: last.locationName,
          countryCode: last.countryCode,
          countryName: last.countryName,
        });
      } else {
        setState((prev) => ({
          ...prev,
          error: "Location unavailable",
          isLoading: false,
        }));
      }
    }
  };

  const updatePosition = useCallback(async (position: GeolocationPosition) => {
    const { latitude, longitude, accuracy } = position.coords;
    
    // Get location info including country
    const { locationName, countryCode, countryName } = await getLocationInfo(latitude, longitude);
    
    setState({
      latitude,
      longitude,
      accuracy,
      error: null,
      isLoading: false,
      locationName,
      countryCode,
      countryName,
    });
    saveLastKnown(latitude, longitude, locationName, countryCode, countryName);
  }, []);

  const handleError = useCallback((error: GeolocationPositionError) => {
    let errorMessage: string;
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = "Location permission denied";
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = "Location unavailable";
        break;
      case error.TIMEOUT:
        errorMessage = "Location request timed out";
        break;
      default:
        errorMessage = "Unknown location error";
    }
    
    ipFallback();
  }, []);

  const refresh = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    
    if (!navigator.geolocation) {
      ipFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(updatePosition, handleError, {
      enableHighAccuracy,
      timeout,
      maximumAge,
    });
  }, [updatePosition, handleError, enableHighAccuracy, timeout, maximumAge]);

  useEffect(() => {
    if (!navigator.geolocation) {
      ipFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(updatePosition, handleError, {
      enableHighAccuracy,
      timeout,
      maximumAge,
    });

    // Watch for location changes
    const watchId = navigator.geolocation.watchPosition(updatePosition, handleError, {
      enableHighAccuracy,
      timeout,
      maximumAge,
    });

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [updatePosition, handleError, enableHighAccuracy, timeout, maximumAge]);

  return { ...state, refresh };
}
