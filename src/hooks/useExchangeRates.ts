import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ExchangeRatesState {
  rates: Record<string, number>;
  base: string;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useExchangeRates(baseCurrency: string = "USD") {
  const [state, setState] = useState<ExchangeRatesState>({
    rates: {},
    base: baseCurrency,
    isLoading: true,
    error: null,
    lastUpdated: null,
  });

  const fetchRates = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const { data, error } = await supabase.functions.invoke("get-exchange-rates", {
        body: { base: baseCurrency },
        ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
      });

      if (error) throw error;

      if (data.success) {
        setState({
          rates: data.rates,
          base: data.base,
          isLoading: false,
          error: null,
          lastUpdated: new Date(),
        });
      } else {
        throw new Error(data.error || "Failed to fetch rates");
      }
    } catch (error) {
      try {
        const response = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(baseCurrency)}`);
        if (!response.ok) {
          throw new Error("Failed to fetch exchange rates");
        }

        const json = await response.json();
        setState({
          rates: { [baseCurrency]: 1, ...(json.rates || {}) },
          base: baseCurrency,
          isLoading: false,
          error: null,
          lastUpdated: new Date(),
        });
      } catch (fallbackError) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: (fallbackError as Error).message,
        }));
      }
    }
  }, [baseCurrency]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  const convert = useCallback(
    (amount: number, from: string, to: string): number | null => {
      if (!state.rates[from] || !state.rates[to]) return null;
      
      // Convert: amount in 'from' currency to 'to' currency
      // rates are relative to base, so: amount / fromRate * toRate
      const fromRate = state.rates[from];
      const toRate = state.rates[to];
      
      return (amount / fromRate) * toRate;
    },
    [state.rates]
  );

  const getRate = useCallback(
    (from: string, to: string): number | null => {
      if (!state.rates[from] || !state.rates[to]) return null;
      return state.rates[to] / state.rates[from];
    },
    [state.rates]
  );

  return {
    ...state,
    convert,
    getRate,
    refresh: fetchRates,
  };
}
