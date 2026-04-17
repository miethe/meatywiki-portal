/**
 * Cookie helpers for portal session management.
 *
 * INVARIANT: The bearer token is stored exclusively in an HttpOnly cookie.
 * It must never be placed in localStorage or sessionStorage.
 *
 * Cookie spec:
 *   Name:     portal_session
 *   Flags:    HttpOnly; SameSite=Lax; Secure (in production)
 *   Path:     /
 *   Max-Age:  7 days (604800 s) — matches the backend session TTL assumption
 */

export const SESSION_COOKIE_NAME = "portal_session";
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

/**
 * Attributes used when setting the session cookie.
 * `secure` is true in production, false in development (http://localhost).
 */
export function sessionCookieAttributes(secure: boolean): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  };
}

/**
 * Returns true when the runtime environment is production-like
 * (i.e., NODE_ENV === "production"). Used to toggle the Secure cookie flag.
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
