// =============================================================
// Netlify Function: OpenRouter proxy (PRODUCTION)
//
// In production the frontend posts chat messages here instead of calling
// OpenRouter directly. This function adds the secret OPENROUTER_API_KEY
// (set in the Netlify dashboard -> Site settings -> Environment variables)
// so the key is never shipped to the browser and users never see a popup.
//
// SECURITY NOTE: As written, anyone who discovers this endpoint URL could
// use your OpenRouter credits. Before charging real users you should:
//   1. Require a valid Supabase session (verify the Authorization JWT), and
//   2. Check that the user has an active subscription / quota.
// A basic same-origin guard is included below via the ALLOWED_ORIGIN env var.
// =============================================================

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

interface NetlifyEvent {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  body: string | null;
}

export const handler = async (event: NetlifyEvent) => {
  const corsHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // Optional same-origin guard. Set ALLOWED_ORIGIN in Netlify to your site URL
  // (e.g. https://your-app.netlify.app) to reject requests from other origins.
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  if (allowedOrigin) {
    const origin = event.headers["origin"] || event.headers["Origin"];
    if (origin && origin !== allowedOrigin) {
      return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: "Forbidden origin" }) };
    }
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Server is missing OPENROUTER_API_KEY environment variable" }),
    };
  }

  let payload: {
    messages?: unknown;
    model?: string;
    jsonMode?: boolean;
    maxTokens?: number;
    temperature?: number;
  };
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  if (!payload.messages || !Array.isArray(payload.messages)) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "messages is required" }) };
  }

  const body: Record<string, unknown> = {
    model: payload.model || "openai/gpt-4o-mini",
    messages: payload.messages,
    temperature: payload.temperature ?? 0.4,
    max_tokens: payload.maxTokens ?? 1500,
  };
  if (payload.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": allowedOrigin || "https://worldlens.app",
        "X-Title": "WorldLens",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let detail = "";
      try {
        const errJson = await res.json();
        detail = errJson?.error?.message || JSON.stringify(errJson);
      } catch {
        detail = await res.text().catch(() => "");
      }
      return { statusCode: res.status, headers: corsHeaders, body: JSON.stringify({ error: `${res.status} ${detail}`.trim() }) };
    }

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ content }) };
  } catch (err) {
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ error: `Failed to reach OpenRouter: ${(err as Error).message}` }),
    };
  }
};
