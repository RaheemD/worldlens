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
    const { destination, interests, duration, tripId } = await req.json();

    if (!destination) {
      return new Response(
        JSON.stringify({ error: "Destination is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are an expert travel planner with deep knowledge of destinations worldwide. Generate personalized travel itineraries and recommendations based on user preferences.

Your recommendations should be:
- Practical and actionable
- Include specific places with names
- Consider local customs and best times to visit
- Include a mix of popular attractions and hidden gems
- Provide tips for getting around and local etiquette`;

    const userPrompt = `Create a travel plan for ${destination}${duration ? ` for ${duration} days` : ""}.
${interests?.length ? `Interests: ${interests.join(", ")}` : "Include a balanced mix of culture, food, and sightseeing."}

Provide the response in this JSON format:
{
  "overview": "Brief 2-3 sentence overview of the destination",
  "bestTimeToVisit": "Best months/seasons to visit",
  "itinerary": [
    {
      "day": 1,
      "title": "Day theme",
      "morning": "Morning activity with specific location",
      "afternoon": "Afternoon activity with specific location",
      "evening": "Evening activity with specific location",
      "tips": ["Practical tip 1", "Practical tip 2"]
    }
  ],
  "mustTry": [
    {"name": "Local dish or experience", "description": "Why it's special"}
  ],
  "packingTips": ["Essential item 1", "Essential item 2"],
  "budgetEstimate": {
    "budget": "$XX-XX per day",
    "midRange": "$XX-XX per day", 
    "luxury": "$XX-XX per day"
  }
}`;

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
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to generate travel plan" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    let travelPlan;
    try {
      travelPlan = JSON.parse(content);
    } catch {
      // If JSON parsing fails, return the raw content
      travelPlan = { overview: content };
    }

    return new Response(
      JSON.stringify({ plan: travelPlan, tripId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating travel plan:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
