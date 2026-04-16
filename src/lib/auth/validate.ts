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
 */

const DEFAULT_API_URL = "http://127.0.0.1:8787";

function getApiBase(): string {
  return process.env.MEATYWIKI_PORTAL_API_URL ?? DEFAULT_API_URL;
}

export interface ValidationResult {
  valid: boolean;
  /** Human-readable reason for rejection, populated on invalid tokens. */
  reason?: string;
}

/**
 * Validates a candidate bearer token against the backend.
 *
 * Sends `POST <backend>/api/auth/session` with the token in the request body.
 * The backend returns 200 `{ valid: true }` on success, or 401 on rejection.
 *
 * Network or parse errors are treated as invalid tokens (fail-closed).
 */
export async function validateTokenWithBackend(
  token: string,
): Promise<ValidationResult> {
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
