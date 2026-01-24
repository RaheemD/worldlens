import { useState, useEffect, useCallback } from "react";

let sharedGeolocationState: GeolocationState | null = null;
let hasAutoRequestedOncePerSession = false;

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
  watch?: boolean;
  autoRequest?: "always" | "once-per-session" | "never";
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const [state, setState] = useState<GeolocationState>(() => {
    if (options.autoRequest === "once-per-session" && sharedGeolocationState) {
      return sharedGeolocationState;
    }
    return {
      latitude: null,
      longitude: null,
      accuracy: null,
      error: null,
      isLoading: true,
      locationName: null,
      countryCode: null,
      countryName: null,
    };
  });

  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
    watch = true,
    autoRequest = "always",
  } = options;

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

  const updateFromCoords = useCallback(async (latitude: number, longitude: number, accuracy: number | null) => {
    const { locationName, countryCode, countryName } = await getLocationInfo(latitude, longitude);

    const nextState: GeolocationState = {
      latitude,
      longitude,
      accuracy,
      error: null,
      isLoading: false,
      locationName,
      countryCode,
      countryName,
    };

    sharedGeolocationState = nextState;
    setState(nextState);
  }, []);

  const updatePosition = useCallback(async (position: GeolocationPosition) => {
    const { latitude, longitude, accuracy } = position.coords;
    await updateFromCoords(latitude, longitude, accuracy);
  }, [updateFromCoords]);

  const fetchIpLocation = useCallback(async (): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const response = await fetch("https://ipapi.co/json/", { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) return null;
      const data = await response.json();
      const latitude = typeof data.latitude === "number" ? data.latitude : parseFloat(data.latitude);
      const longitude = typeof data.longitude === "number" ? data.longitude : parseFloat(data.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      return { latitude, longitude };
    } catch {
      return null;
    }
  }, []);

  const fallbackToIp = useCallback(async (): Promise<GeolocationState | null> => {
    const ipLocation = await fetchIpLocation();
    if (!ipLocation) return null;
    await updateFromCoords(ipLocation.latitude, ipLocation.longitude, null);
    return sharedGeolocationState;
  }, [fetchIpLocation, updateFromCoords]);

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
    
    setState((prev) => ({
      ...prev,
      error: errorMessage,
      isLoading: false,
    }));
  }, []);

  const handleGeoError = useCallback(async (error: GeolocationPositionError) => {
    const fallback = await fallbackToIp();
    if (fallback) return;
    handleError(error);
  }, [fallbackToIp, handleError]);

  const refresh = useCallback((): Promise<GeolocationState | null> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    return new Promise((resolve) => {
      const run = async () => {
        if (!navigator.geolocation) {
          const fallback = await fallbackToIp();
          if (fallback) {
            resolve(fallback);
            return;
          }
          setState((prev) => ({
            ...prev,
            error: "Geolocation not supported",
            isLoading: false,
          }));
          resolve(null);
          return;
        }

        hasAutoRequestedOncePerSession = true;
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            await updatePosition(position);
            resolve(sharedGeolocationState);
          },
          async (err) => {
            const fallback = await fallbackToIp();
            if (fallback) {
              resolve(fallback);
              return;
            }
            handleError(err);
            resolve(null);
          },
          {
            enableHighAccuracy,
            timeout,
            maximumAge,
          }
        );
      };
      run();
    });
  }, [updatePosition, handleError, enableHighAccuracy, timeout, maximumAge, fallbackToIp]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    const run = async () => {
      if (autoRequest === "never") {
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      if (autoRequest === "once-per-session" && hasAutoRequestedOncePerSession) {
        if (sharedGeolocationState) {
          setState(sharedGeolocationState);
        } else {
          const fallback = await fallbackToIp();
          if (!fallback && !cancelled) {
            setState((prev) => ({ ...prev, isLoading: false }));
          }
        }
        return;
      }

      if (!navigator.geolocation) {
        const fallback = await fallbackToIp();
        if (fallback || cancelled) return;
        setState((prev) => ({
          ...prev,
          error: "Geolocation not supported",
          isLoading: false,
        }));
        return;
      }

      if (autoRequest === "once-per-session") {
        hasAutoRequestedOncePerSession = true;
      }

      navigator.geolocation.getCurrentPosition(updatePosition, handleGeoError, {
        enableHighAccuracy,
        timeout,
        maximumAge,
      });

      if (!watch) return;

      const watchId = navigator.geolocation.watchPosition(updatePosition, handleGeoError, {
        enableHighAccuracy,
        timeout,
        maximumAge,
      });

      cleanup = () => navigator.geolocation.clearWatch(watchId);
    };

    run();

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [updatePosition, handleGeoError, enableHighAccuracy, timeout, maximumAge, watch, autoRequest, fallbackToIp]);

  return { ...state, refresh };
}
