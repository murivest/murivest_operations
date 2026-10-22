import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/queries";

const SUPABASE_URL =
  import.meta.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
const SUPABASE_KEY =
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
  process.env["SUPABASE_PUBLISHABLE_KEY"];

/**
 * Deletes the signed-in user's own account.
 *
 * supabase-js no longer ships a user-facing `auth.deleteUser()`, so the GoTrue
 * self-service endpoint is called directly with the session's access token.
 * If GoTrue refuses the request (an expired session, or a project that has
 * self-service deletion disabled), a server-side routine owned by the
 * database performs the same deletion.
 *
 * Every path is scoped to the caller's own account: the request is made with
 * the caller's own JWT, and the database routine refuses any user id other
 * than the one in the caller's token.
 */
export async function deleteCurrentAccount(): Promise<void> {
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error(
      "Your session has expired. Please sign in again and repeat this action to finish deleting your account.",
    );
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase is not configured, so the account cannot be deleted.");
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (response.ok) return;

  const detail = await response.text();
  const reason = extractReason(detail);

  // The database routine is the fallback for anything GoTrue refuses.
  const { error } = await callRpc("delete_current_account", {});
  if (!error) return;

  throw new Error(
    reason
      ? `The account could not be deleted automatically (${reason}).`
      : "The account could not be deleted automatically.",
  );
}

function extractReason(body: string): string | null {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as { msg?: string; message?: string; error?: string };
    return parsed.msg ?? parsed.message ?? parsed.error ?? null;
  } catch {
    return body.slice(0, 200);
  }
}
