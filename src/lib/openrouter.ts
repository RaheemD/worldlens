// =============================================================
// OpenRouter client (LOCAL / frontend mode)
//
// For local development the OpenRouter API key is provided by the user
// through a popup and stored in localStorage. This means AI calls run
// directly from the browser. When you move to production you should move
// these calls into Supabase Edge Functions so the key stays secret.
// =============================================================

const STORAGE_KEY = "worldlens_openrouter_key";

// Default models. gpt-4o-mini supports both text and vision and is cheap.
export const DEFAULT_TEXT_MODEL = "openai/gpt-4o-mini";
export const DEFAULT_VISION_MODEL = "openai/gpt-4o-mini";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// In production the app routes AI calls through a serverless proxy that holds
// the secret key, so users never see the API-key popup. Locally (dev) the
// proxy is off and the user's own key (from the popup) is used directly.
//   - Override with VITE_AI_PROXY_URL if you host the proxy elsewhere.
//   - Defaults to the Netlify Function path in production builds.
const AI_PROXY_URL: string =
  (import.meta.env.VITE_AI_PROXY_URL as string | undefined) ||
  (import.meta.env.PROD ? "/.netlify/functions/openrouter" : "");

export function isProxyMode(): boolean {
  return AI_PROXY_URL.length > 0;
}

// ---- key management ----------------------------------------------------
export function getOpenRouterKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export function setOpenRouterKey(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, key.trim());
}

export function clearOpenRouterKey(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function hasOpenRouterKey(): boolean {
  return getOpenRouterKey().length > 0;
}

// ---- dialog request mechanism ------------------------------------------
// invokeAI() calls requestApiKey(); if no key is stored it dispatches an
// event that the global <ApiKeyDialog> listens for, then resolves once the
// user submits (or with "" if they cancel).
export const API_KEY_EVENT = "worldlens:request-api-key";

let pendingResolvers: Array<(key: string) => void> = [];

export function requestApiKey(): Promise<string> {
  const existing = getOpenRouterKey();
  if (existing) return Promise.resolve(existing);

  return new Promise<string>((resolve) => {
    pendingResolvers.push(resolve);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(API_KEY_EVENT));
    }
  });
}

export function fulfillApiKeyRequest(key: string): void {
  setOpenRouterKey(key);
  const resolvers = pendingResolvers;
  pendingResolvers = [];
  resolvers.forEach((resolve) => resolve(key));
}

export function cancelApiKeyRequest(): void {
  const resolvers = pendingResolvers;
  pendingResolvers = [];
  resolvers.forEach((resolve) => resolve(""));
}

// ---- chat completion ---------------------------------------------------
export interface ChatMessageContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ChatMessageContentPart[];
}

export interface ChatOptions {
  model?: string;
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Sends a chat completion request to OpenRouter and returns the message
 * text content. Throws an Error whose message includes the HTTP status
 * (e.g. "429", "402", "401") so callers can show useful toasts.
 */
export async function openRouterChat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  // ---- Production: route through the serverless proxy (key stays secret) ----
  if (isProxyMode()) {
    let response: Response;
    try {
      response = await fetch(AI_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          model: options.model ?? DEFAULT_TEXT_MODEL,
          jsonMode: options.jsonMode ?? false,
          maxTokens: options.maxTokens ?? 1500,
          temperature: options.temperature ?? 0.4,
        }),
      });
    } catch (networkErr) {
      throw new Error(`Network error contacting AI service: ${(networkErr as Error).message}`);
    }

    if (!response.ok) {
      let detail = "";
      try {
        const errJson = await response.json();
        detail = errJson?.error || JSON.stringify(errJson);
      } catch {
        detail = await response.text().catch(() => "");
      }
      throw new Error(`${response.status} ${detail}`.trim());
    }

    const json = await response.json();
    return (json?.content as string) ?? "";
  }

  // ---- Local dev: call OpenRouter directly with the user's own key ----
  const key = getOpenRouterKey();
  if (!key) {
    throw new Error("401 Missing OpenRouter API key");
  }

  const body: Record<string, unknown> = {
    model: options.model ?? DEFAULT_TEXT_MODEL,
    messages,
    temperature: options.temperature ?? 0.4,
    max_tokens: options.maxTokens ?? 1500,
  };

  if (options.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
        "X-Title": "WorldLens",
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new Error(`Network error contacting OpenRouter: ${(networkErr as Error).message}`);
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errJson = await response.json();
      detail = errJson?.error?.message || JSON.stringify(errJson);
    } catch {
      detail = await response.text().catch(() => "");
    }
    if (response.status === 401) {
      // Stored key is invalid - clear it so the user is re-prompted next time.
      clearOpenRouterKey();
    }
    throw new Error(`${response.status} ${detail}`.trim());
  }

  const json = await response.json();
  const content: string = json?.choices?.[0]?.message?.content ?? "";
  return content;
}

/**
 * Helper that parses a JSON object out of a model response, tolerating
 * markdown code fences and surrounding prose.
 */
export function parseJsonResponse<T = unknown>(raw: string): T {
  let text = raw.trim();

  // Strip ```json ... ``` or ``` ... ``` fences.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // Fall back to the first {...} or [...] block.
  if (!text.startsWith("{") && !text.startsWith("[")) {
    const objStart = text.indexOf("{");
    const arrStart = text.indexOf("[");
    const start =
      objStart === -1 ? arrStart : arrStart === -1 ? objStart : Math.min(objStart, arrStart);
    if (start >= 0) {
      text = text.slice(start);
    }
  }

  return JSON.parse(text) as T;
}
