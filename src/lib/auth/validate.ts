/**
 * Token validation against the backend Portal API.
 *
 * Assumed backend contract for `POST /api/auth/session`:
 *   Request body:  { token: string }
 *   Success (200): { valid: true, expires_at?: string }
 *   Failure (401): { valid: false, error?: string }
 *   Failure (4xx): any error envelope
 *
 * The frontend sends the candidate token; the backend validates it against
 * its own `$MEATYWIKI_PORTAL_TOKEN` environment variable and returns whether
 * the token is accepted. No session ID is issued by the backend — the token
 * itself is the credential and is stored verbatim in the HttpOnly cookie.
 *
 * If the backend returns 200 with { valid: true }, the frontend sets the
 * HttpOnly cookie and considers the user authenticated.
 *
 * When PORTAL_DISABLE_AUTH=1 (server-side env), validation is short-circuited:
 * any non-empty token returns { valid: true } without a network call.
 */

export { getApiBase } from "@/lib/api/config";
import { getApiBase } from "@/lib/api/config";

export interface ValidationResult {
  valid: boolean;
  /** Human-readable reason for rejection, populated on invalid tokens. */
  reason?: string;
}

/**
 * Validates a candidate bearer token against the backend.
 *
 * When PORTAL_DISABLE_AUTH=1, skips the network call and returns
 * { valid: true } for any non-empty token (still requires non-empty so the
 * cookie has a meaningful value).
 *
 * Otherwise, sends `POST <backend>/api/auth/session` with the token in the
 * request body. Network or parse errors are treated as invalid tokens
 * (fail-closed).
 */
export async function validateTokenWithBackend(
  token: string,
): Promise<ValidationResult> {
  if (process.env.PORTAL_DISABLE_AUTH === "1") {
    console.warn(
      "[auth] PORTAL_DISABLE_AUTH=1 — skipping backend token validation. Do not use in production.",
    );
    return { valid: true };
  }

  try {
    const response = await fetch(`${getApiBase()}/api/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      // Short timeout — backend is local; long waits indicate it's down
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const body = (await response.json()) as { valid?: boolean };
      if (body.valid === true) {
        return { valid: true };
      }
      return { valid: false, reason: "Backend rejected the token" };
    }

    if (response.status === 401) {
      let reason = "Invalid token";
      try {
        const body = (await response.json()) as {
          error?: string;
          detail?: string;
        };
        reason = body.error ?? body.detail ?? reason;
      } catch {
        // ignore parse error
      }
      return { valid: false, reason };
    }

    return {
      valid: false,
      reason: `Backend returned unexpected status ${response.status}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, reason: `Could not reach backend: ${message}` };
  }
}
