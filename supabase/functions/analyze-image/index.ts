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
    const { image } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Validate and ensure proper image format
    if (!image || typeof image !== 'string') {
      throw new Error("Image data is required");
    }

    // Ensure the image has a proper data URL prefix
    let imageUrl = image;
    if (!image.startsWith('data:')) {
      // If it's raw base64, add the JPEG prefix (most common)
      imageUrl = `data:image/jpeg;base64,${image}`;
    } else if (!image.includes(';base64,')) {
      throw new Error("Invalid image format - must be base64 encoded");
    }

    console.log("Image URL prefix:", imageUrl.substring(0, 50));

    const systemPrompt = `You are WorldLens, an AI travel assistant that analyzes images to provide travel intelligence.

Analyze the image and respond with ONLY valid JSON in this format:
{
  "category": "monument" | "menu" | "sign" | "ticket" | "product" | "document" | "nature" | "art" | "other",
  "name": "Name or title of what's in the image",
  "description": "Brief description explaining what this is",
  "detected_location": "The actual location of the subject in the image (e.g., 'Dubai, UAE' for Burj Khalifa, 'Paris, France' for Eiffel Tower). This should be where the landmark/subject is located, NOT where the photo was taken. Return null if location cannot be determined.",
  "extracted_text": "Any text visible in the image, translated to English if needed",
  "prices": [{"item": "Item name", "price": 1234, "currency": "JPY"}],
  "tips": ["Useful tip 1", "Useful tip 2"],
  "warnings": ["Any warnings or things to be careful about"]
}

IMPORTANT: For landmarks, monuments, and recognizable locations, always set "detected_location" to where that landmark actually exists in the world.
Be accurate and helpful. Extract prices with their currency if visible.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this image and provide travel intelligence." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
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
      const errorText = await response.text();
      console.error("OpenRouter error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    // Parse the JSON response
    let result;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      result = {
        category: "other",
        name: "Unknown",
        description: content,
        details: {},
        warnings: [],
        tips: [],
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-image error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
