import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { locationName, countryCode, latitude, longitude } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a travel safety advisor. Provide accurate, helpful safety information for travelers.

Respond with ONLY valid JSON in this format:
{
  "safetyLevel": "safe" | "caution" | "warning",
  "alerts": [
    {
      "type": "scam" | "safety" | "health" | "weather" | "event",
      "title": "Alert title",
      "description": "Brief description",
      "severity": "low" | "medium" | "high"
    }
  ],
  "tips": ["Safety tip 1", "Safety tip 2", ...],
  "emergencyNumbers": {
    "police": "number",
    "ambulance": "number",
    "fire": "number",
    "tourist_hotline": "number or null"
  },
  "customsInfo": "Brief customs/cultural note for travelers"
}

Provide real, accurate emergency numbers for the country.
Include 3-5 relevant safety tips for tourists.
Include any active travel advisories or common scams.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Provide safety information for a tourist visiting ${locationName || "this location"}, ${countryCode || "Unknown Country"}. Coordinates: ${latitude}, ${longitude}` 
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    let result;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      result = JSON.parse(jsonStr);
    } catch {
      result = {
        safetyLevel: "safe",
        alerts: [],
        tips: ["Stay aware of your surroundings", "Keep valuables secure", "Have emergency contacts saved"],
        emergencyNumbers: { police: "911", ambulance: "911", fire: "911" },
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("get-safety-info error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
