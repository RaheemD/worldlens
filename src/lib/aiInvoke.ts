// =============================================================
// Client-side replacement for supabase.functions.invoke(...)
//
// Each "edge function" the app used to call is implemented here and runs
// directly in the browser using the user's OpenRouter API key. The return
// shape { data, error } matches supabase.functions.invoke so call sites
// barely change.
//
// NOTE: This exposes the OpenRouter key in the browser and is intended for
// LOCAL use only. For production, recreate these as Supabase Edge Functions
// that hold the key as a server secret.
// =============================================================

import {
  openRouterChat,
  parseJsonResponse,
  requestApiKey,
  isProxyMode,
  DEFAULT_TEXT_MODEL,
  DEFAULT_VISION_MODEL,
  type ChatMessage,
} from "./openrouter";
import { supabase } from "@/integrations/supabase/client";

interface InvokeOptions {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

interface InvokeResult<T = unknown> {
  data: T | null;
  error: Error | null;
}

// Ensure we have a key (prompts the user via the global dialog if missing).
// In production proxy mode the server holds the key, so no prompt is needed.
async function ensureKey(): Promise<Error | null> {
  if (isProxyMode()) return null;
  const key = await requestApiKey();
  if (!key) {
    return new Error("OpenRouter API key is required to use AI features.");
  }
  return null;
}

// -------------------------------------------------------------------------
// analyze-image
// -------------------------------------------------------------------------
async function analyzeImage(body: InvokeOptions["body"]): Promise<InvokeResult> {
  const image = body?.image as string;
  if (!image) return { data: null, error: new Error("No image provided") };

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are WorldLens, a travel assistant that analyzes photos for tourists. " +
        "Identify what is in the image (monument, landmark, menu, sign, ticket, food, product, etc.). " +
        "Respond ONLY with a JSON object using this exact schema: " +
        '{"category": string (one of "monument","restaurant","menu","sign","ticket","food","product","nature","other"), ' +
        '"name": string, "description": string (2-4 helpful sentences for a traveler), ' +
        '"detected_location": string|null (place/city/country if identifiable, else null), ' +
        '"extracted_text": string (any visible text, original language, else ""), ' +
        '"prices": [{"item": string, "price": number, "currency": string}] (else []), ' +
        '"warnings": [string] (safety/scam/etiquette warnings, else []), ' +
        '"tips": [string] (useful traveler tips, else []), ' +
        '"details": object (any extra structured facts, else {})}',
    },
    {
      role: "user",
      content: [
        { type: "text", text: "Analyze this image for a traveler." },
        { type: "image_url", image_url: { url: image } },
      ],
    },
  ];

  const raw = await openRouterChat(messages, {
    model: DEFAULT_VISION_MODEL,
    jsonMode: true,
    maxTokens: 1200,
  });
  return { data: parseJsonResponse(raw), error: null };
}

// -------------------------------------------------------------------------
// translate
// -------------------------------------------------------------------------
async function translate(body: InvokeOptions["body"]): Promise<InvokeResult> {
  const text = body?.text as string;
  const targetLanguage = body?.targetLanguage as string;
  if (!text) return { data: null, error: new Error("No text provided") };

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        `You are a translation engine. Translate the user's text into ${targetLanguage}. ` +
        "Respond ONLY with a JSON object: " +
        '{"translation": string (the translated text), ' +
        '"pronunciation": string (romanized/phonetic pronunciation if the target script is non-Latin, else "")}',
    },
    { role: "user", content: text },
  ];

  const raw = await openRouterChat(messages, {
    model: DEFAULT_TEXT_MODEL,
    jsonMode: true,
    maxTokens: 800,
  });
  return { data: parseJsonResponse(raw), error: null };
}

// -------------------------------------------------------------------------
// scan-receipt
// -------------------------------------------------------------------------
async function scanReceipt(body: InvokeOptions["body"]): Promise<InvokeResult> {
  const image = body?.image as string;
  const currency = (body?.currency as string) || "USD";
  if (!image) return { data: null, error: new Error("No image provided") };

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You extract structured data from receipt photos. " +
        `Default currency is ${currency} if none is visible. ` +
        "Respond ONLY with a JSON object: " +
        '{"items": [{"name": string, "price": number, "category": string (e.g. "Food","Transport","Shopping","Accommodation","Other")}], ' +
        '"merchant": string, "currency": string (ISO code), "location": string, ' +
        '"date": string (YYYY-MM-DD if visible, else ""), "total": number}',
    },
    {
      role: "user",
      content: [
        { type: "text", text: "Extract the line items from this receipt." },
        { type: "image_url", image_url: { url: image } },
      ],
    },
  ];

  const raw = await openRouterChat(messages, {
    model: DEFAULT_VISION_MODEL,
    jsonMode: true,
    maxTokens: 1200,
  });
  return { data: parseJsonResponse(raw), error: null };
}

// -------------------------------------------------------------------------
// get-safety-info
// -------------------------------------------------------------------------
async function getSafetyInfo(body: InvokeOptions["body"]): Promise<InvokeResult> {
  const locationName = body?.locationName as string;
  const countryCode = body?.countryCode as string;

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are a travel safety advisor. Given a location, provide current, practical safety guidance for tourists. " +
        "Respond ONLY with a JSON object: " +
        '{"safetyLevel": "safe"|"caution"|"warning", ' +
        '"alerts": [{"type": string, "title": string, "description": string, "severity": "low"|"medium"|"high"}], ' +
        '"tips": [string] (5-7 concise tips), ' +
        '"emergencyNumbers": {"police": string, "ambulance": string, "fire": string, "tourist_hotline": string}, ' +
        '"customsInfo": string (local etiquette/cultural notes)}. ' +
        "Use accurate emergency numbers for the given country.",
    },
    {
      role: "user",
      content: `Location: ${locationName || "Unknown"}. Country code: ${countryCode || "Unknown"}.`,
    },
  ];

  const raw = await openRouterChat(messages, {
    model: DEFAULT_TEXT_MODEL,
    jsonMode: true,
    maxTokens: 1200,
  });
  return { data: parseJsonResponse(raw), error: null };
}

// -------------------------------------------------------------------------
// plan-trip
// -------------------------------------------------------------------------
async function planTrip(body: InvokeOptions["body"]): Promise<InvokeResult> {
  const destination = body?.destination as string;
  const duration = (body?.duration as number) || 3;
  const interests = (body?.interests as string[]) || [];

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are an expert travel planner. Create a detailed, realistic plan. " +
        "Respond ONLY with a JSON object: " +
        '{"plan": {' +
        '"overview": string, "bestTimeToVisit": string, ' +
        '"itinerary": [{"day": number, "title": string, "morning": string, "afternoon": string, "evening": string, "tips": [string]}], ' +
        '"mustTry": [{"name": string, "description": string}], ' +
        '"packingTips": [string], ' +
        '"budgetEstimate": {"budget": string, "midRange": string, "luxury": string}}}. ' +
        `The itinerary MUST contain exactly ${duration} day objects.`,
    },
    {
      role: "user",
      content:
        `Plan a ${duration}-day trip to ${destination}.` +
        (interests.length ? ` Traveler interests: ${interests.join(", ")}.` : ""),
    },
  ];

  const raw = await openRouterChat(messages, {
    model: DEFAULT_TEXT_MODEL,
    jsonMode: true,
    maxTokens: 3000,
  });
  return { data: parseJsonResponse(raw), error: null };
}

// -------------------------------------------------------------------------
// generate-summary (writes result back to the trips table)
// -------------------------------------------------------------------------
async function generateSummary(body: InvokeOptions["body"]): Promise<InvokeResult> {
  const tripId = body?.tripId as string;
  const type = (body?.type as "summary" | "story") || "summary";
  if (!tripId) return { data: null, error: new Error("No tripId provided") };

  // Gather trip + its scan entries for context.
  const { data: trip, error: tripErr } = await supabase
    .from("trips")
    .select("name, destination, start_date, end_date")
    .eq("id", tripId)
    .single();
  if (tripErr || !trip) {
    return { data: null, error: new Error(tripErr?.message || "Trip not found") };
  }

  const { data: entries } = await supabase
    .from("scan_entries")
    .select("name, category, description, location_name, notes")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });

  const entryLines =
    (entries || [])
      .map(
        (e) =>
          `- ${e.name || e.category} (${e.category})` +
          (e.location_name ? ` at ${e.location_name}` : "") +
          (e.description ? `: ${e.description}` : "")
      )
      .join("\n") || "No saved scans yet.";

  const isStory = type === "story";
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: isStory
        ? "You are a travel writer. Write a warm, vivid, shareable first-person travel story (2-4 short paragraphs) based on the trip details. Respond with plain text only."
        : "You are a travel journal assistant. Write a concise, friendly recap (1-2 paragraphs) summarizing the trip highlights. Respond with plain text only.",
    },
    {
      role: "user",
      content:
        `Trip: ${trip.name}\nDestination: ${trip.destination || "Unknown"}\n` +
        `Dates: ${trip.start_date || "?"} to ${trip.end_date || "?"}\n\nHighlights:\n${entryLines}`,
    },
  ];

  const text = await openRouterChat(messages, {
    model: DEFAULT_TEXT_MODEL,
    maxTokens: 900,
  });

  const updates = isStory
    ? { shareable_story: text.trim() }
    : { ai_summary: text.trim() };

  const { error: updErr } = await supabase.from("trips").update(updates).eq("id", tripId);
  if (updErr) return { data: null, error: new Error(updErr.message) };

  return { data: { success: true }, error: null };
}

// -------------------------------------------------------------------------
// get-exchange-rates (no AI key needed - uses a free public API)
// -------------------------------------------------------------------------
async function getExchangeRates(body: InvokeOptions["body"]): Promise<InvokeResult> {
  const base = (body?.base as string) || "USD";
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}`
    );
    if (!res.ok) throw new Error("Failed to fetch exchange rates");
    const json = await res.json();
    return {
      data: { success: true, base, rates: { [base]: 1, ...(json.rates || {}) } },
      error: null,
    };
  } catch (err) {
    return { data: { success: false, error: (err as Error).message }, error: null };
  }
}

// -------------------------------------------------------------------------
// Dispatcher
// -------------------------------------------------------------------------
const AI_FUNCTIONS = new Set([
  "analyze-image",
  "translate",
  "scan-receipt",
  "get-safety-info",
  "plan-trip",
  "generate-summary",
]);

export async function invokeAI<T = unknown>(
  name: string,
  options: InvokeOptions = {}
): Promise<InvokeResult<T>> {
  try {
    // get-exchange-rates does not need the OpenRouter key.
    if (name !== "get-exchange-rates" && AI_FUNCTIONS.has(name)) {
      const keyErr = await ensureKey();
      if (keyErr) return { data: null, error: keyErr };
    }

    switch (name) {
      case "analyze-image":
        return (await analyzeImage(options.body)) as InvokeResult<T>;
      case "translate":
        return (await translate(options.body)) as InvokeResult<T>;
      case "scan-receipt":
        return (await scanReceipt(options.body)) as InvokeResult<T>;
      case "get-safety-info":
        return (await getSafetyInfo(options.body)) as InvokeResult<T>;
      case "plan-trip":
        return (await planTrip(options.body)) as InvokeResult<T>;
      case "generate-summary":
        return (await generateSummary(options.body)) as InvokeResult<T>;
      case "get-exchange-rates":
        return (await getExchangeRates(options.body)) as InvokeResult<T>;
      default:
        return { data: null, error: new Error(`Unknown AI function: ${name}`) };
    }
  } catch (err) {
    return { data: null, error: err as Error };
  }
}
