/**
 * Server-side session helpers.
 *
 * `getSession()` reads the HttpOnly `portal_session` cookie and returns the
 * token string, or null if no session cookie is present. This function is
 * intentionally thin — validation against the backend is performed at login
 * time and optionally at the middleware layer.
 *
 * IMPORTANT: This module is server-only. It imports `next/headers` which is
 * not available in client components. Do not import it from client code.
 */

import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "./cookies";

export interface Session {
  /** The raw bearer token stored in the session cookie. */
  token: string;
}

/**
 * Reads the current session from the request cookies.
 *
 * Returns `null` when:
 * - No `portal_session` cookie is present
 * - The cookie value is an empty string
 *
 * Does NOT re-validate the token against the backend on every call;
 * token validation happens at login and middleware only.
 */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();

  // Auth-disabled mode: return a synthetic local session so server-side gates
  // (layouts calling redirect("/login")) do not fire. cookies() is read ABOVE
  // first so the route stays dynamic (avoids a static-prerender crash on pages
  // that fetch live data). Node runtime reads process.env at request time — no
  // build-time inline needed here (unlike the Edge middleware).
  if (process.env.PORTAL_DISABLE_AUTH === "1") {
    return { token: "" };
  }

  const tokenCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!tokenCookie?.value) {
    return null;
  }

  return { token: tokenCookie.value };
}

/**
 * Convenience helper: returns true when a session cookie is present.
 * Use in layouts/pages for quick auth checks; redirects happen in middleware.
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}
