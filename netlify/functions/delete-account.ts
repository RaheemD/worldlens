// =============================================================
// Netlify Function: delete-account (PRODUCTION)
//
// Permanently deletes the signed-in user's account. Because every user table
// in the database uses "ON DELETE CASCADE" against auth.users, deleting the
// auth user also removes their profile, scans, trips, spending, ai_usage, and
// roles automatically.
//
// REQUIRED Netlify environment variables (Site settings -> Environment variables):
//   - SUPABASE_SERVICE_ROLE_KEY : the service_role secret from
//       Supabase Dashboard -> Settings -> API  (KEEP SECRET, server-side only)
//   - VITE_SUPABASE_URL is already set and is reused here for the project URL.
//
// Security: the caller must send their own Supabase access token. We verify
// that token to find the user, then delete only that user. No one can delete
// another account.
// =============================================================

interface NetlifyEvent {
  httpMethod: string;
  headers: Record<string, string | undefined>;
}

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (event: NetlifyEvent) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return json(401, { error: "Missing authorization" });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json(500, {
      error: "Account deletion is not configured. Missing SUPABASE_SERVICE_ROLE_KEY.",
    });
  }

  // 1) Verify the caller's token and get their user id.
  let userId: string | undefined;
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SERVICE_ROLE },
    });
    if (!userRes.ok) {
      return json(401, { error: "Invalid or expired session" });
    }
    const user = await userRes.json();
    userId = user?.id;
  } catch (err) {
    return json(502, { error: `Could not verify session: ${(err as Error).message}` });
  }

  if (!userId) {
    return json(401, { error: "Could not identify the user" });
  }

  // 2) Hard-delete the user (cascades all related data in public tables).
  try {
    const delRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
    });
    if (!delRes.ok) {
      const detail = await delRes.text().catch(() => "");
      return json(500, { error: `Failed to delete account: ${detail}`.trim() });
    }
  } catch (err) {
    return json(502, { error: `Deletion request failed: ${(err as Error).message}` });
  }

  return json(200, { success: true });
};
