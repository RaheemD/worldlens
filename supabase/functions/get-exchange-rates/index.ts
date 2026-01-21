import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory cache for rates (persists for function lifetime)
let cachedRates: { rates: Record<string, number>; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { base = 'USD' } = await req.json().catch(() => ({ base: 'USD' }));
    
    // Check cache
    const now = Date.now();
    if (cachedRates && (now - cachedRates.timestamp) < CACHE_DURATION) {
      // Convert cached USD rates to requested base
      const baseRate = cachedRates.rates[base] || 1;
      const convertedRates: Record<string, number> = {};
      
      for (const [currency, rate] of Object.entries(cachedRates.rates)) {
        convertedRates[currency] = rate / baseRate;
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          base, 
          rates: convertedRates,
          cached: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch fresh rates from Frankfurter API (free, no API key needed)
    // It uses European Central Bank data
    const response = await fetch('https://api.frankfurter.app/latest?from=USD');
    
    if (!response.ok) {
      throw new Error('Failed to fetch exchange rates');
    }

    const data = await response.json();
    
    // Store in cache (always store USD-based rates)
    cachedRates = {
      rates: { USD: 1, ...data.rates },
      timestamp: now,
    };

    // Convert to requested base currency
    const baseRate = cachedRates.rates[base] || 1;
    const convertedRates: Record<string, number> = {};
    
    for (const [currency, rate] of Object.entries(cachedRates.rates)) {
      convertedRates[currency] = (rate as number) / baseRate;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        base, 
        rates: convertedRates,
        date: data.date,
        cached: false 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Exchange rate error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to get exchange rates';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});