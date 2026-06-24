// =============================================================
// Netlify Function: exchange-rates proxy (PRODUCTION)
//
// Fetches currency exchange rates server-side so the browser never makes a
// cross-origin call (which was being blocked by CORS). Tries two providers
// for reliability and returns a normalized { success, base, rates } shape
// where the base currency is 1.0.
// =============================================================

interface NetlifyEvent {
  httpMethod: string;
  queryStringParameters: Record<string, string | undefined> | null;
}

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
  body: JSON.stringify(body),
});

export const handler = async (event: NetlifyEvent) => {
  const base = (event.queryStringParameters?.base || "USD").toUpperCase();

  // Provider 1: open.er-api.com (base-relative, base = 1)
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.result === "success" && data?.rates) {
        return json(200, { success: true, base, rates: data.rates });
      }
    }
  } catch {
    /* fall through to next provider */
  }

  // Provider 2: frankfurter.app (rates are relative to `from`; add base = 1)
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.rates) {
        return json(200, { success: true, base, rates: { [base]: 1, ...data.rates } });
      }
    }
  } catch {
    /* fall through to error */
  }

  return json(200, { success: false, error: "Failed to fetch exchange rates" });
};
