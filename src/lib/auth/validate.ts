/**
 * Token validation against the backend Portal API.
 *
 * Backend contract for `GET /api/auth/validate`:
 *   Auth:          Authorization: Bearer <token> header
 *   Success (200): { valid: true, user_id: "local" }
 *   Failure (401): returned by BearerTokenAuthMiddleware when token is
 *                  missing or invalid; body may be { error: string } or
 *                  { detail: string }
 *   Other 4xx/5xx: unexpected error envelope
 *
 * The frontend sends the candidate token as a Bearer header; the backend
 * validates it against its own `$MEATYWIKI_PORTAL_TOKEN` environment variable
 * and returns whether the token is accepted. No session ID is issued by the
 * backend — the token itself is the credential and is stored verbatim in the
 * HttpOnly cookie.
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
 * Otherwise, sends `GET <backend>/auth/validate` against the configured API
 * base with the token in an
 * Authorization: Bearer header. Network or parse errors are treated as
 * invalid tokens (fail-closed).
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
    const response = await fetch(`${getApiBase()}/auth/validate`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
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
      } catch (err) {
        console.warn(
          "[auth] Failed to parse 401 error detail:",
          err instanceof Error ? err.message : String(err),
        );
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
