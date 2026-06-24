import { useState, useEffect, useCallback } from "react";
import { invokeAI } from "@/lib/aiInvoke";

interface ExchangeRatesState {
  rates: Record<string, number>;
  base: string;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

interface RatesPayload {
  success: boolean;
  rates: Record<string, number>;
  base: string;
  error?: string;
}

// --- Shared cache + in-flight dedupe across all hook instances ---
// Exchange rates barely change, and several components use this hook at once.
// Without sharing, each one fired its own network request (the console flood).
const RATES_TTL_MS = 60 * 60 * 1000; // 1 hour
const ratesCache = new Map<string, { rates: Record<string, number>; base: string; at: number }>();
const inflight = new Map<string, Promise<RatesPayload>>();

async function loadRates(base: string): Promise<RatesPayload> {
  const cached = ratesCache.get(base);
  if (cached && Date.now() - cached.at < RATES_TTL_MS) {
    return { success: true, rates: cached.rates, base: cached.base };
  }

  const existing = inflight.get(base);
  if (existing) return existing;

  const promise = (async (): Promise<RatesPayload> => {
    const { data } = await invokeAI<RatesPayload>("get-exchange-rates", { body: { base } });
    if (data?.success && data.rates) {
      ratesCache.set(base, { rates: data.rates, base: data.base, at: Date.now() });
      return { success: true, rates: data.rates, base: data.base };
    }
    return { success: false, rates: {}, base, error: data?.error || "Failed to fetch rates" };
  })();

  inflight.set(base, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(base);
  }
}

export function useExchangeRates(baseCurrency: string = "USD") {
  const base = (baseCurrency || "USD").toUpperCase();
  const [state, setState] = useState<ExchangeRatesState>({
    rates: ratesCache.get(base)?.rates ?? {},
    base,
    isLoading: !ratesCache.get(base),
    error: null,
    lastUpdated: ratesCache.get(base) ? new Date(ratesCache.get(base)!.at) : null,
  });

  const fetchRates = useCallback(
    async (force = false) => {
      if (force) ratesCache.delete(base);
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const result = await loadRates(base);
      if (result.success) {
        setState({
          rates: result.rates,
          base: result.base,
          isLoading: false,
          error: null,
          lastUpdated: new Date(),
        });
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: result.error || "Failed to fetch exchange rates",
        }));
      }
    },
    [base]
  );

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  const convert = useCallback(
    (amount: number, from: string, to: string): number | null => {
      if (!state.rates[from] || !state.rates[to]) return null;
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
    refresh: () => fetchRates(true),
  };
}
