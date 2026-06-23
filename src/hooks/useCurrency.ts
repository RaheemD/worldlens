import { useMemo } from "react";
import { useProfile } from "@/contexts/ProfileContext";
import { useGeolocation } from "./useGeolocation";
import { getCurrencyFromCountry, formatCurrency, currencySymbols } from "@/lib/currency";

// Special value to indicate "use location-based currency"
export const USE_LOCATION_CURRENCY = "AUTO_LOCATION";

interface UseCurrencyResult {
  localCurrency: string; // Currency based on GPS location
  homeCurrency: string; // User's preferred currency (respects explicit setting)
  activeCurrency: string; // The currency to actually use for spending (homeCurrency if set, else localCurrency)
  formatLocal: (amount: number) => string;
  formatHome: (amount: number) => string;
  formatActive: (amount: number) => string;
  getSymbol: (currencyCode: string) => string;
  format: (amount: number, currencyCode: string) => string;
  isUsingLocationCurrency: boolean;
}

export function useCurrency(): UseCurrencyResult {
  const { profile } = useProfile();
  const { countryCode } = useGeolocation();

  // Currency detected from GPS location
  const localCurrency = useMemo(() => {
    if (countryCode) {
      return getCurrencyFromCountry(countryCode);
    }
    return "USD";
  }, [countryCode]);

  // Check if user explicitly wants to use location-based currency
  const isUsingLocationCurrency = profile?.preferred_currency === USE_LOCATION_CURRENCY;

  // User's saved currency preference
  const homeCurrency = useMemo(() => {
    if (!profile?.preferred_currency || profile.preferred_currency === USE_LOCATION_CURRENCY) {
      return localCurrency; // Fall back to location currency
    }
    return profile.preferred_currency;
  }, [profile?.preferred_currency, localCurrency]);

  // The active currency to use for spending - prioritizes user preference
  const activeCurrency = useMemo(() => {
    // If user has set to use location, or hasn't set anything, use location
    if (isUsingLocationCurrency || !profile?.preferred_currency) {
      return localCurrency;
    }
    // Otherwise use the explicitly set currency
    return profile.preferred_currency;
  }, [profile?.preferred_currency, localCurrency, isUsingLocationCurrency]);

  const formatLocal = (amount: number) => formatCurrency(amount, localCurrency);
  const formatHome = (amount: number) => formatCurrency(amount, homeCurrency);
  const formatActive = (amount: number) => formatCurrency(amount, activeCurrency);
  const format = (amount: number, currencyCode: string) => formatCurrency(amount, currencyCode);
  const getSymbol = (currencyCode: string) => currencySymbols[currencyCode] || currencyCode;

  return {
    localCurrency,
    homeCurrency,
    activeCurrency,
    formatLocal,
    formatHome,
    formatActive,
    getSymbol,
    format,
    isUsingLocationCurrency,
  };
}
