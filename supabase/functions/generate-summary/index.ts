import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getUser(token);
    if (authError || !claims.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tripId, type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch trip data
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .eq("user_id", claims.user.id)
      .single();

    if (tripError || !trip) {
      throw new Error("Trip not found");
    }

    // Fetch scan entries for this trip
    const { data: scans, error: scansError } = await supabase
      .from("scan_entries")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true });

    if (scansError) {
      throw new Error("Failed to fetch scans");
    }

    // Fetch spending records for this trip
    const { data: spending, error: spendingError } = await supabase
      .from("spending_records")
      .select("*")
      .eq("user_id", claims.user.id)
      .gte("date", trip.start_date || "1900-01-01")
      .lte("date", trip.end_date || "2100-12-31");

    const tripData = {
      name: trip.name,
      destination: trip.destination,
      startDate: trip.start_date,
      endDate: trip.end_date,
      scans: scans?.map((s) => ({
        category: s.category,
        name: s.name,
        description: s.description,
        location: s.location_name,
        date: s.created_at,
      })) || [],
      totalSpending: spending?.reduce((sum, s) => sum + Number(s.amount), 0) || 0,
      spendingByCategory: spending?.reduce((acc, s) => {
        acc[s.category] = (acc[s.category] || 0) + Number(s.amount);
        return acc;
      }, {} as Record<string, number>) || {},
    };

    let systemPrompt: string;
    let userPrompt: string;

    if (type === "summary") {
      systemPrompt = `You are a travel journal AI. Create a concise, informative summary of a trip.
Keep it factual and highlight the key experiences, places visited, and spending overview.
Respond with ONLY valid JSON:
{
  "summary": "A 2-3 paragraph summary of the trip",
  "highlights": ["Key highlight 1", "Key highlight 2", "Key highlight 3"],
  "stats": {
    "placesVisited": number,
    "topCategory": "Most visited category",
    "totalSpent": "Formatted total spending"
  }
}`;
      userPrompt = `Generate a trip summary for: ${JSON.stringify(tripData)}`;
    } else {
      systemPrompt = `You are a travel storyteller. Create an engaging, shareable travel story from trip data.
Write in first person, make it personal and vivid. Include emojis tastefully.
The story should be suitable for sharing on social media (2-3 short paragraphs).
Respond with ONLY valid JSON:
{
  "story": "The shareable story text",
  "title": "A catchy title for the story",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"]
}`;
      userPrompt = `Create a shareable travel story for: ${JSON.stringify(tripData)}`;
    }

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
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
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
      result = { error: "Failed to generate content" };
    }

    // Save the generated content to the trip
    if (type === "summary" && result.summary) {
      await supabase
        .from("trips")
        .update({ ai_summary: result.summary })
        .eq("id", tripId);
    } else if (type === "story" && result.story) {
      await supabase
        .from("trips")
        .update({ shareable_story: result.story })
        .eq("id", tripId);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-summary error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
